import axios from 'axios';
import { calculatePKCECodeChallenge, generateRandomCodeVerifier } from 'oauth4webapi';
import { courseSchedule } from './CourseSchedule.js';
/**
 * 飞书SDK（优化版）
 * 1. 支持PKCE安全机制（code_verifier/code_challenge）
 * 2. 对接本地后端代理接口（避免跨域+保护appSecret）
 * 3. 符合飞书OAuth 2.0规范，使用authen/v1/user_info接口
 */
export class FeishuClient {
    /**
     * 构造函数
     * @param {Object} options 配置项
     * @param {string} options.appId 飞书应用App ID（即client_id）
     * @param {string} options.redirectUri 授权回调地址（需在飞书开放平台配置）
     */
    constructor(options) {
        // 验证必要参数
        if (!options.appId || !options.redirectUri) {
            throw new Error('请提供飞书应用的App ID和redirectUri');
        }

        // 配置参数
        this.appId = options.appId;                     // client_id（前端仅需暴露appId）
        this.redirectUri = options.redirectUri;         // 授权回调地址

        // 存储用户令牌信息
        this.userTokenInfo = {
            accessToken: null,
            refreshToken: null,
            expireTime: 0
        };

        // 从本地存储恢复用户令牌和PKCE相关数据
        this._restoreUserTokenFromStorage();
    }

    /**
     * 从本地存储恢复用户令牌
     */
    _restoreUserTokenFromStorage() {
        const savedUserToken = localStorage.getItem('feishu_user_token');
        if (savedUserToken) {
            this.userTokenInfo = JSON.parse(savedUserToken);
        }
    }

    /**
     * 保存用户令牌到本地存储
     */
    _saveUserTokenToStorage() {
        localStorage.setItem('feishu_user_token', JSON.stringify(this.userTokenInfo));
    }

    /**
     * 生成PKCE需要的code_verifier（随机字符串，43-128位）
     * @returns {string} code_verifier
     */
    _generateCodeVerifier() {
        const verifier = generateRandomCodeVerifier();
        // 存储code_verifier到本地，兑换时使用
        localStorage.setItem('feishu_code_verifier', verifier);
        return verifier;
    }

    /**
     * 从code_verifier生成code_challenge（SHA-256哈希 + base64url编码）
     * @param {string} verifier code_verifier
     * @returns {Promise<string>} code_challenge
     */
    async _generateCodeChallenge(verifier) {
        return await calculatePKCECodeChallenge(verifier);
    }

    /**
     * 生成飞书授权链接（支持PKCE机制）
     * @param {string[]} scopes 所需权限列表（默认user_info基础权限）
     * @returns {Promise<string>} 授权链接
     */
    async getAuthorizationUrl(scopes = []) {
        // 1. 生成防CSRF的state
        const state = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('feishu_auth_state', state);

        // 2. 生成PKCE的code_verifier和code_challenge
        const codeVerifier = this._generateCodeVerifier();
        const codeChallenge = await this._generateCodeChallenge(codeVerifier);

        // 3. 拼接飞书授权链接（符合飞书authen/v1/authorize接口规范）
        // 创建基础URL
        const url = new URL('/feishu-api/authen/v1/authorize', window.location.origin);
        // 定义所有查询参数对象
        const params = {
            client_id: this.appId,
            redirect_uri: this.redirectUri,
            scope: scopes.join(' '),
            state: state,
            response_type: 'code',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        };

        // 一次性设置所有查询参数
        url.search = new URLSearchParams(params).toString();

        // 返回完整URL
        return url.toString();
    }

    /**
     * 用授权码兑换用户令牌（对接后端代理接口，不直接调用飞书API）
     * @param {string} code 飞书返回的授权码
     * @returns {Promise<Object>} 用户令牌信息（access_token/refresh_token等）
     */
    async exchangeCodeForToken(code) {
        try {
            // 1. 获取本地存储的code_verifier（PKCE必需）
            const codeVerifier = localStorage.getItem('feishu_code_verifier');
            if (!codeVerifier) {
                throw new Error('未找到code_verifier，请重新发起授权');
            }

            // 2. 调用本地后端代理接口（而非直接调用飞书API，避免跨域+保护appSecret）
            const response = await axios.post(
                `/proxy-api/feishu/exchange-token`, // 后端代理接口地址
                {
                    code: code,                          // 飞书返回的授权码
                    redirectUri: this.redirectUri,       // 回调地址（与授权时一致）
                    codeVerifier: codeVerifier           // PKCE的code_verifier（传给后端）
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            // 3. 处理后端返回结果（后端已转发飞书响应，格式与飞书一致）
            if (response.data.code !== 0) {
                throw new Error(`兑换user_access_token失败: ${response.data.msg || '未知错误'}`);
            }

            // 4. 存储用户令牌到本地
            const now = Date.now() / 1000; // 当前时间（秒级）
            this.userTokenInfo = {
                accessToken: response.data.access_token,  // 飞书用户access_token
                refreshToken: response.data.refresh_token, // 飞书用户refresh_token
                expireTime: now + response.data.expires_in // 令牌过期时间（秒级）
            };
            this._saveUserTokenToStorage();

            // 5. 兑换成功后清除临时存储的code_verifier
            localStorage.removeItem('feishu_code_verifier');

            return this.userTokenInfo;
        } catch (error) {
            console.error('兑换user_access_token失败:', error.message);
            this.clearUserToken(); // 兑换失败时清除无效数据
            throw error;
        }
    }

    /**
     * 刷新用户令牌（对接后端代理接口）
     * @returns {Promise<Object>} 新的用户令牌信息
     */
    async refreshUserToken() {
        if (!this.userTokenInfo.refreshToken) {
            throw new Error('没有可用的refresh_token，请重新授权');
        }

        try {
            // 调用后端代理的刷新接口（后端保管appSecret，前端不接触）
            const response = await axios.post(
                `/proxy-api/feishu/refresh-token`, // 后端刷新接口
                {
                    refreshToken: this.userTokenInfo.refreshToken // 传递refresh_token
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data.code !== 0) {
                throw new Error(`刷新user_access_token失败: ${response.data.msg || '未知错误'}`);
            }

            // 更新并存储新的令牌信息
            const now = Date.now() / 1000;
            this.userTokenInfo = {
                accessToken: response.data.data.access_token,
                refreshToken: response.data.data.refresh_token,
                expireTime: now + response.data.data.expires_in
            };
            this._saveUserTokenToStorage();

            return this.userTokenInfo;
        } catch (error) {
            console.error('刷新user_access_token失败:', error.message);
            this.clearUserToken(); // 刷新失败时清除旧令牌
            throw error;
        }
    }

    /**
     * 获取有效的用户令牌（自动判断是否需要刷新）
     * @returns {Promise<string>} 有效的access_token
     */
    async getUserAccessToken() {
        const now = Date.now() / 1000;

        // 令牌未过期（预留60秒缓冲，避免网络延迟导致过期）
        if (this.userTokenInfo.accessToken && this.userTokenInfo.expireTime > now + 60) {
            return this.userTokenInfo.accessToken;
        }

        // 令牌过期，刷新后返回新令牌
        return this.refreshUserToken().then(tokenInfo => tokenInfo.accessToken);
    }

    /**
     * 清除用户令牌及本地存储的用户信息
     */
    clearUserToken() {
        this.userTokenInfo = {
            accessToken: null,
            refreshToken: null,
            expireTime: 0
        };
        localStorage.removeItem('feishu_user_token');
        localStorage.removeItem('feishu_current_user');
        localStorage.removeItem('feishu_code_verifier'); // 同时清除PKCE临时数据
        localStorage.removeItem('feishu_auth_state');
    }

    /**
     * 通用请求方法（调用飞书API，需access_token授权）
     * @param {string} method 请求方法（GET/POST/PUT等）
     * @param {string} path 飞书API路径（如/open-apis/authen/v1/user_info）
     * @param {Object|null} data POST/PUT请求的请求体
     * @param {Object|null} params GET请求的查询参数
     * @returns {Promise<Object>} 飞书API返回的data字段
     */
    async request(method, path, data = null, params = null) {
        try {
            const token = await this.getUserAccessToken();

            // 直接调用飞书API（此接口需access_token，无跨域问题，因为是授权后请求）
            const response = await axios({
                method,
                url: `/feishu-api` + path,
                headers: {
                    'Authorization': `Bearer ${token}`, // 携带access_token授权
                    'Content-Type': 'application/json'  // 飞书API默认JSON格式
                },
                data,
                params
            });

            // 处理飞书API错误（code≠0为错误）
            if (response.data.code !== 0) {
                // 令牌相关错误（如过期、无效），清除令牌并提示重新授权
                if ([901001, 901002, 901003, 901004].includes(response.data.code)) {
                    this.clearUserToken();
                    throw new Error(`令牌无效，请重新授权（错误码: ${response.data.code}）`);
                }
                throw new Error(`API调用失败: ${response.data.msg} (错误码: ${response.data.code})`);
            }

            return response.data.data; // 返回飞书API的data字段（核心数据）
        } catch (error) {
            console.error(`飞书API请求失败[${method} ${path}]:`, error.message);
            throw error;
        }
    }

    /**
     * GET请求快捷方法
     */
    async get(path, params = null) {
        return this.request('GET', path, null, params);
    }

    /**
     * POST请求快捷方法
     */
    async post(path, data = null) {
        return this.request('POST', path, data);
    }

    /**
     * 检查是否已登录（令牌存在且未过期）
     * @returns {boolean} 是否已登录
     */
    isLoggedIn() {
        const now = Date.now() / 1000;
        return !!this.userTokenInfo.accessToken && this.userTokenInfo.expireTime > now;
    }

    /**
     * 处理授权回调（前端拿到code后调用，完成登录流程）
     * @param {string} code 飞书授权后返回的code
     * @param {string} state 飞书返回的state（用于防CSRF校验）
     * @returns {Promise<Object>} 用户信息（登录成功后返回）
     */
    async handleAuthCallback(code, state) {
        // 1. 校验state（防CSRF攻击，必须与授权时的state一致）
        const savedState = localStorage.getItem('feishu_auth_state');
        if (!savedState || state !== savedState) {
            throw new Error('授权状态验证失败，可能存在安全风险');
        }

        // 2. 清除临时存储的state
        localStorage.removeItem('feishu_auth_state');

        // 3. 用code兑换令牌，再获取用户信息（完成登录）
        await this.exchangeCodeForToken(code);
        return this.getCurrentUser();
    }

    /**
     * 获取当前用户信息（使用飞书authen/v1/user_info接口，符合规范）
     * @returns {Promise<Object>} 整理后的用户信息
     */
    async getCurrentUser() {
        try {
            // 调用飞书authen/v1/user_info接口（需user_info权限，无需后端代理）
            const data = await this.get('/authen/v1/user_info');

            // 整理用户信息（适配飞书返回格式，过滤无用字段）
            const userInfo = {
                userId: data.user_id,           // 飞书用户ID（企业内唯一）
                openId: data.open_id,           // 飞书开放平台ID（跨应用唯一）
                unionId: data.union_id || '',   // 飞书联合ID（跨企业唯一，需申请权限）
                name: data.name,                // 中文姓名
                enName: data.en_name || '',     // 英文姓名
                avatar: data.avatar_url || '',  // 头像URL
                email: data.email || '',        // 个人邮箱（需申请权限）
                enterpriseEmail: data.enterprise_email || '', // 企业邮箱（需申请权限）
                mobile: data.mobile || ''       // 手机号（需申请权限）
            };

            // 保存用户信息到本地，方便后续使用
            localStorage.setItem('feishu_current_user', JSON.stringify(userInfo));
            return userInfo;
        } catch (error) {
            console.error('获取用户信息失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取指定多维表中course_information表内的课程数据
     * @param {string} openId 用户的open_id，用于过滤属于该用户的课程
     * @returns {Promise<Object>} 过滤后的课程数据
     */
    async getCourseInfoTableMetadata(openId = null) {
        const config = await getConfig();
        const appToken = config.VITE_FEISHU_DATABASE_ID;
        if (!appToken) {
            throw new Error('未找到多维表app_token配置');
        }

        try {
            // 1. 获取指定app下的所有表，找到course_information表
            const tablesData = await this.get(`/bitable/v1/apps/${appToken}/tables`, {
                page_size: 10
            });

            const targetTable = tablesData.items.find(
                table => table.name === 'course_information'
            );

            if (!targetTable) {
                throw new Error('未找到名为course_information的表');
            }

            // 2. 构建查询条件
            const searchBody = {};

            // 如果提供了openId，添加过滤条件
            if (openId) {
                const currentWeek = courseSchedule.getCurrentWeek();
                searchBody.filter = {
                    conjunction: "and",
                    conditions: [
                        {
                            field_name: "student_info",
                            operator: "is",
                            value: [openId]
                        },
                        {
                            field_name: "start_week",
                            operator: "isLessEqual",
                            value: [currentWeek.toString()]
                        },
                        {
                            field_name: "end_week",
                            operator: "isGreaterEqual",
                            value: [currentWeek.toString()]
                        }
                    ]
                };
            }

            // 3. 调用记录搜索接口
            const recordsResponse = await this.post(
                `/bitable/v1/apps/${appToken}/tables/${targetTable.table_id}/records/search`,
                searchBody
            );

            return recordsResponse; // 返回格式：{ items: [...记录列表] }

        } catch (error) {
            console.error('获取course_information表的记录失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取指定名称的多维表信息
     * @param {string} tableName 要查找的表名
     * @returns {Promise<Object>} 表信息，包含table_id等
     * @private
     */
    async _getTableInfo(tableName) {
        const config = await getConfig();
        const appToken = config.VITE_FEISHU_DATABASE_ID;
        if (!appToken) {
            throw new Error('未找到多维表app_token配置');
        }

        const tablesData = await this.get(`/bitable/v1/apps/${appToken}/tables`, {
            page_size: 10
        });

        const targetTable = tablesData.items.find(
            table => table.name === tableName
        );

        if (!targetTable) {
            throw new Error(`未找到名为${tableName}的表`);
        }

        return {
            appToken,
            ...targetTable
        };
    }

    /**
     * 导入课程到飞书多维表
     * @param {Array<Object>} courses 课程数据数组
     * @returns {Promise<Array<Object>>} 导入成功的课程记录数组
     */
    async importMetadatasToCourseInfoTable(courses) {
        try {
            // 1. 获取当前用户信息
            const userInfo = await this.getCurrentUser();

            // 2. 获取课程信息表
            const tableInfo = await this._getTableInfo('course_information');

            // 3. 覆盖课程数据中的student_info字段
            const coursesWithStudentInfo = courses.map(course => ({
                ...course,
                student_info: [{ id: userInfo.openId }] // 使用对象形式，兼容人员字段
            }));

            // 4. 构造请求体
            const requestBody = {
                records: coursesWithStudentInfo.map(course => ({
                    fields: course
                }))
            };

            // 5. 调用批量创建记录接口
            const response = await this.post(
                `/bitable/v1/apps/${tableInfo.appToken}/tables/${tableInfo.table_id}/records/batch_create`,
                requestBody
            );

            // 6. 返回创建成功的记录
            return response.records;

        } catch (error) {
            console.error('导入课程失败:', error);
            throw new Error(`导入课程失败: ${error.message}`);
        }
    }
}

// 获取配置的异步函数
async function getConfig() {
    try {
        const response = await fetch('/api/config');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch config:', error);
        // 返回默认值
        return {
            VITE_FEISHU_APP_ID: '',
            VITE_FEISHU_REDIRECT_URI: 'http://localhost:8787',
            VITE_FEISHU_DATABASE_ID: ''
        };
    }
}

// 初始化飞书SDK实例
let feishuClient = null;

// 异步初始化函数
export async function initFeishuClient() {
    if (!feishuClient) {
        const config = await getConfig();
        feishuClient = new FeishuClient({
            appId: config.VITE_FEISHU_APP_ID,
            redirectUri: config.VITE_FEISHU_REDIRECT_URI || 'http://localhost:8787',
        });
    }
    return feishuClient;
}

// 导出一个获取客户端的函数
export { feishuClient };