// 应用初始化文件 - 纯前端代码
import { initFeishuClient } from './js/FeishuClient.js';
import { courseSchedule } from './js/CourseSchedule.js';

// 全局变量存储 feishuClient 实例
let feishuClient = null;
// 全局变量存储当前显示的周数
let currentViewWeek = null;
// 全局变量存储所有课程数据
let allCourses = [];

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
	// 初始化飞书客户端
	feishuClient = await initFeishuClient();

	// 检查是否是授权回调
	const params = new URLSearchParams(window.location.search);
	const code = params.get('code');
	const state = params.get('state');

	if (code && state) {
		// 处理飞书授权回调
		handleAuthCallback(code, state);
	} else {
		// 正常访问，检查登录状态
		checkLoginStatus();
	}
});

// 渲染应用外壳
function renderAppShell() {
	const appElement = document.getElementById('app');

	// 检查是否已登录
	if (!feishuClient.isLoggedIn()) {
		// 未登录 - 显示登录页面
		appElement.innerHTML = `
      <div class="login-page">
        <div class="login-container">
          <div class="login-card">
            <div class="login-header">
              <i class="fa fa-graduation-cap login-logo"></i>
              <h1 class="login-title">飞书课程表</h1>
              <p class="login-subtitle">使用飞书账号登录以管理您的课程</p>
            </div>
            <div class="login-body">
              <button id="loginBtn" class="login-button">
                <i class="fa fa-sign-in"></i>
                <span>使用飞书登录</span>
              </button>
            </div>
            <div class="login-footer">
              <p class="login-tips">登录后即可查看和管理课程表</p>
            </div>
          </div>
        </div>
      </div>
    `;

		// 绑定登录按钮
		document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
		return;
	}

	// 已登录 - 显示主界面
	appElement.innerHTML = `
        <div class="app-wrapper">
            <!-- 头像按钮（收起时显示） -->
            <button id="avatarToggle" class="avatar-toggle">
                <img id="miniAvatar" src="" alt="" class="mini-avatar">
            </button>
            
            <!-- 左侧导航栏 -->
            <nav id="sidebar" class="sidebar">
            <div class="sidebar-header">
                <h2 class="sidebar-title">
                    <i class="fa fa-graduation-cap"></i>
                    <span class="sidebar-text">课程管理</span>
                </h2>
                <button id="sidebarToggle" class="sidebar-toggle">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            
            <div class="sidebar-content">
                <!-- 用户信息区域 -->
                <div id="userSection" class="sidebar-section">
                    <div class="sidebar-user-info">
                        <img id="userAvatar" src="" alt="" class="sidebar-avatar">
                        <div class="sidebar-user-details">
                            <span id="userName" class="sidebar-username"></span>
                            <span class="sidebar-user-status">在线</span>
                        </div>
                    </div>
                    
                    <!-- 功能菜单 -->
                    <div class="sidebar-menu-wrapper">
                        <div class="sidebar-item-header">
                            <i class="fa fa-cog"></i>
                            <span class="sidebar-text">功能</span>
                        </div>
                        
                        <div class="sidebar-item">
                            <button class="sidebar-btn" id="homeBtn">
                                <i class="fa fa-home"></i>
                                <span class="sidebar-text">课程表</span>
                            </button>
                        </div>
                        
                        <div class="sidebar-item">
                            <button class="sidebar-btn" id="courseManageBtn">
                                <i class="fa fa-list-alt"></i>
                                <span class="sidebar-text">课程管理</span>
                            </button>
                        </div>
                        
                        <div class="sidebar-item">
                            <button class="sidebar-btn" id="importBtn">
                                <i class="fa fa-upload"></i>
                                <span class="sidebar-text">导入课程</span>
                            </button>
                            <input type="file" id="courseFile" accept=".json" class="sidebar-file-input" style="display: none;">
                        </div>
                        
                        <!-- 导入对话框 -->
                        <div id="importDialog" class="dialog-overlay" style="display: none;">
                            <div class="dialog-content">
                                <div class="dialog-header">
                                    <h3>导入课程</h3>
                                    <button class="dialog-close" id="closeImportDialog">
                                        <i class="fa fa-times"></i>
                                    </button>
                                </div>
                                <div class="dialog-body">
                                    <div class="file-drop-zone" id="dropZone">
                                        <i class="fa fa-cloud-upload"></i>
                                        <p>拖放文件到这里或点击选择文件</p>
                                        <small>支持 .json 格式文件</small>
                                    </div>
                                    <div class="import-options">
                                        <label class="checkbox-label">
                                            <input type="checkbox" id="syncCalendar">
                                            <span>同步到飞书日程</span>
                                        </label>
                                        <div id="reminderOptions" class="reminder-options" style="display: none; margin-top: 10px; padding-left: 25px;">
                                            <label style="display: block; margin-bottom: 5px; color: #666;">提醒时间：</label>
                                            <select name="reminder" style="width: 150px; padding: 6px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;">
                                                <option value="none" selected>不提醒</option>
                                                <option value="5min">5分钟前</option>
                                                <option value="15min">15分钟前</option>
                                                <option value="30min">30分钟前</option>
                                                <option value="60min">1小时前</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="dialog-footer">
                                    <button class="dialog-btn secondary" id="cancelImport">取消</button>
                                    <button class="dialog-btn primary" id="confirmImport">导入</button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 同步进度对话框 -->
                        <div id="syncProgressDialog" class="dialog-overlay" style="display: none;">
                            <div class="dialog-content" style="max-width: 400px;">
                                <div class="dialog-header">
                                    <h3>正在同步到飞书日程</h3>
                                </div>
                                <div class="dialog-body" style="padding: 20px;">
                                    <div class="sync-progress-container">
                                        <div class="progress-bar">
                                            <div id="progressBarFill" class="progress-bar-fill" style="width: 0%"></div>
                                        </div>
                                        <div class="progress-text">
                                            <span id="progressText">准备同步...</span>
                                        </div>
                                        <div class="progress-details" style="margin-top: 10px;">
                                            <small id="progressDetails" style="color: #666;"></small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 创建全部日程对话框 -->
                        <div id="syncAllDialog" class="dialog-overlay" style="display: none;">
                            <div class="dialog-content" style="max-width: 600px;">
                                <div class="dialog-header">
                                    <h3>创建全部课程日程</h3>
                                    <button class="dialog-close" id="closeSyncAllDialog">
                                        <i class="fa fa-times"></i>
                                    </button>
                                </div>
                                <div class="dialog-body">
                                    <div class="course-list-container" style="max-height: 400px; overflow-y: auto;">
                                        <div id="courseCheckList" class="course-check-list">
                                            <!-- 动态生成课程列表 -->
                                        </div>
                                    </div>
                                    <div class="sync-options" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                                        <div style="margin-bottom: 15px;">
                                            <label class="checkbox-label">
                                                <input type="checkbox" id="selectAllCourses" checked>
                                                <span>全选课程</span>
                                            </label>
                                        </div>
                                        <div>
                                            <label style="display: block; margin-bottom: 5px; color: #666;">提醒时间：</label>
                                            <select name="batchReminder" style="width: 150px; padding: 6px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;">
                                                <option value="none" selected>不提醒</option>
                                                <option value="5min">5分钟前</option>
                                                <option value="15min">15分钟前</option>
                                                <option value="30min">30分钟前</option>
                                                <option value="60min">1小时前</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="dialog-footer">
                                    <button class="dialog-btn secondary" id="cancelSyncAll">取消</button>
                                    <button class="dialog-btn primary" id="confirmSyncAll">创建日程</button>
                                </div>
                            </div>
                        </div>
                        
                        <button id="refreshCourses" class="sidebar-btn">
                            <i class="fa fa-refresh"></i>
                            <span class="sidebar-text">刷新数据</span>
                        </button>
                        
                        <button id="syncAllCourses" class="sidebar-btn">
                            <i class="fa fa-calendar-plus-o"></i>
                            <span class="sidebar-text">创建全部日程</span>
                        </button>
                        
                        <button id="deleteAllCalendar" class="sidebar-btn danger">
                            <i class="fa fa-calendar-times-o"></i>
                            <span class="sidebar-text">删除课程日历</span>
                        </button>
                        
                        <button id="deleteCourses" class="sidebar-btn danger">
                            <i class="fa fa-trash"></i>
                            <span class="sidebar-text">清空课程</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- 底部退出按钮 -->
            <div class="sidebar-footer">
                <button id="logoutBtn" class="sidebar-logout-btn">
                    <i class="fa fa-sign-out"></i>
                    <span class="sidebar-text">退出登录</span>
                </button>
            </div>
        </nav>
        
        <!-- 主内容区 -->
        <div class="main-container">
            <!-- 顶部栏 -->
            <header class="top-bar">
                <div class="week-navigator" id="weekNavigator">
                    <button id="prevWeekBtn" class="week-nav-btn" title="上一周">
                        <i class="fa fa-chevron-left"></i>
                    </button>
                    <div class="week-display">
                        <span id="weekNumber" class="week-number">第1周</span>
                        <span id="weekDateRange" class="week-date-range"></span>
                        <button id="currentWeekBtn" class="current-week-btn" title="回到当前周">
                            <i class="fa fa-undo"></i> 本周
                        </button>
                    </div>
                    <button id="nextWeekBtn" class="week-nav-btn" title="下一周">
                        <i class="fa fa-chevron-right"></i>
                    </button>
                </div>
            </header>
            
            <!-- 课程表内容 -->
            <main class="content-area">
                <!-- 课程表视图 -->
                <div id="scheduleView" class="view-container">
                    <div id="courseTable" class="course-table-container"></div>
                    
                    <!-- 空状态 -->
                    <div id="emptyState" class="empty-state" style="display: none;">
                        <i class="fa fa-calendar-o"></i>
                        <h3>暂无课程数据</h3>
                        <p>请先导入课程表</p>
                    </div>
                </div>
                
                <!-- 课程管理视图 -->
                <div id="managementView" class="view-container" style="display: none;">
                    <div class="management-container">
                        <div class="management-header" style="
                            display: flex;
                            align-items: center;
                            padding: 20px;
                            border-bottom: 1px solid #e0e0e0;
                            background: white;
                        ">
                            <button id="backToHome" class="action-btn" style="
                                border: none;
                                background: none;
                                color: #666;
                                cursor: pointer;
                                font-size: 14px;
                                padding: 8px 12px;
                                border-radius: 6px;
                                transition: all 0.3s;
                            " onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='none'">
                                <i class="fa fa-arrow-left" style="margin-right: 6px;"></i> 返回
                            </button>
                            <div style="
                                flex: 1;
                                text-align: center;
                                font-size: 18px;
                                font-weight: 500;
                                color: #333;
                            ">
                                <i class="fa fa-list-alt" style="margin-right: 8px; color: #667eea;"></i>
                                课程日程管理
                            </div>
                            <div style="width: 60px;"></div> <!-- 占位元素，保持标题居中 -->
                        </div>
                        <div id="courseList" class="course-list">
                            <!-- 动态生成课程列表 -->
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- 消息提示 -->
        <div id="message" class="message"></div>
    </div>
    `;

	// 初始化侧边栏交互
	initSidebarInteractions();
	// 初始化周导航
	initWeekNavigation();
	// 初始化时间显示
	updateDateTime();
}

// 检查登录状态
async function checkLoginStatus() {
	try {
		if (feishuClient.isLoggedIn()) {
			// 已登录，获取用户信息并显示
			const userInfo = await feishuClient.getCurrentUser();
			renderAppShell(); // 重新渲染主界面
			showUserSection(userInfo);

			// 初始化当前查看周（周末时显示下一周）
			const actualCurrentWeek = courseSchedule.getCurrentWeek();
			const now = new Date();
			const dayOfWeek = now.getDay(); // 0是周日，6是周六


			if (dayOfWeek === 0 || dayOfWeek === 6) {
				currentViewWeek = Math.min(actualCurrentWeek + 1, courseSchedule.getTotalWeeks());
			} else {
				currentViewWeek = actualCurrentWeek;
			}

			await loadAndRenderCourses();

			// 默认收起侧边栏
			const sidebar = document.getElementById('sidebar');
			const avatarToggle = document.getElementById('avatarToggle');
			if (sidebar && avatarToggle) {
				sidebar.classList.remove('show');
				avatarToggle.style.display = 'flex';
			}
		} else {
			// 未登录，显示登录界面
			renderAppShell();
		}
	} catch (error) {
		showMessage('登录状态验证失败，请重新登录', 'error');
		renderAppShell();
	}
}

// 处理授权回调
async function handleAuthCallback(code, state) {
	try {
		// 先显示一个加载中的页面
		const appElement = document.getElementById('app');
		appElement.innerHTML = `
      <div class="login-page">
        <div class="login-container">
          <div class="login-card">
            <div class="login-header">
              <i class="fa fa-spinner fa-spin login-logo"></i>
              <h1 class="login-title">正在登录...</h1>
              <p class="login-subtitle">正在验证您的飞书账号</p>
            </div>
          </div>
        </div>
      </div>
    `;

		// 处理飞书回调，获取用户信息
		const userInfo = await feishuClient.handleAuthCallback(code, state);

		// 清除URL中的code和state参数，美化URL
		history.replaceState({}, document.title, window.location.pathname);

		// 重新渲染主界面
		renderAppShell();

		// 显示用户区域
		showUserSection(userInfo);
		showMessage('登录成功，欢迎使用！', 'success');

		// 加载课程
		await loadAndRenderCourses();

		// 默认收起侧边栏
		const sidebar = document.getElementById('sidebar');
		const avatarToggle = document.getElementById('avatarToggle');
		if (sidebar && avatarToggle) {
			// 不要使用 display: none，让 CSS transform 来处理隐藏
			sidebar.classList.remove('show');
			avatarToggle.style.display = 'flex';
		}
	} catch (error) {
		// 授权失败时显示登录页
		renderAppShell();
		showMessage('授权失败: ' + error.message, 'error');
	}
}

// 处理登录
async function handleLogin() {
	// 生成授权链接并跳转
	const authUrl = await feishuClient.getAuthorizationUrl([
		'base:view:read', 'base:table:read', 'base:app:read',
		'base:record:create', 'base:record:retrieve', 'base:record:update',
		'calendar:calendar', 'calendar:calendar:create', 'calendar:calendar:read'
	]);
	window.location.href = authUrl;
}

// 显示用户区域和用户信息
function showUserSection(userInfo) {
	// 填充用户信息
	const avatar = document.getElementById('userAvatar');
	const miniAvatar = document.getElementById('miniAvatar');
	const avatarUrl = userInfo.avatar || 'https://picsum.photos/200';

	if (avatar) {
		avatar.src = avatarUrl;
		avatar.style.display = 'block';
	}

	if (miniAvatar) {
		miniAvatar.src = avatarUrl;
	}

	// 显示用户名
	const userName = document.getElementById('userName');
	if (userName) {
		userName.textContent = userInfo.name || userInfo.enName || '未知用户';
	}

	// 添加退出登录事件
	document.getElementById('logoutBtn')?.addEventListener('click', () => {
		if (confirm('确定要退出登录吗？')) {
			feishuClient.clearUserToken();
			showMessage('已退出登录');
			window.location.reload(); // 重新加载页面
		}
	});

	// 添加导入按钮点击事件
	document.getElementById('importBtn')?.addEventListener('click', showImportDialog);

	// 添加首页/课程表按钮点击事件
	document.getElementById('homeBtn')?.addEventListener('click', () => {
		// 显示课程表视图
		document.getElementById('scheduleView').style.display = 'block';
		// 隐藏课程管理视图
		document.getElementById('managementView').style.display = 'none';
		// 显示周导航
		document.getElementById('weekNavigator').style.display = 'flex';
	});

	// 添加课程管理按钮点击事件
	document.getElementById('courseManageBtn')?.addEventListener('click', async () => {
		// 隐藏课程表视图
		document.getElementById('scheduleView').style.display = 'none';
		// 显示课程管理视图
		document.getElementById('managementView').style.display = 'block';
		// 隐藏周导航
		document.getElementById('weekNavigator').style.display = 'none';
		// 加载课程管理页面
		await loadCourseManagement();
	});

	// 添加返回首页按钮事件（课程管理页面顶部）
	document.addEventListener('click', (e) => {
		if (e.target.closest('#backToHome')) {
			// 显示课程表视图
			document.getElementById('scheduleView').style.display = 'block';
			// 隐藏课程管理视图
			document.getElementById('managementView').style.display = 'none';
			// 显示周导航
			document.getElementById('weekNavigator').style.display = 'flex';
		}
	});

	// 初始化导入对话框
	initImportDialog();
	
	// 添加创建全部日程按钮事件
	document.getElementById('syncAllCourses')?.addEventListener('click', showSyncAllDialog);
	
	// 添加删除课程日历按钮事件
	document.getElementById('deleteAllCalendar')?.addEventListener('click', async () => {
		if (confirm('确定要删除课程日历吗？这将删除所有已创建的课程日程，并清空数据库中的日程ID。')) {
			try {
				await deleteCourseCalendar();
				// 如果在课程管理页面，刷新页面以更新状态
				if (document.getElementById('managementView').style.display !== 'none') {
					await loadCourseManagement();
				}
			} catch (error) {
				showMessage('删除失败: ' + error.message, 'error');
			}
		}
	});

	// 初始化导入对话框
	initImportDialog();

	// 添加清空课程事件
	document.getElementById('deleteCourses')?.addEventListener('click', async () => {
		if (confirm('确定要清空所有课程吗？')) {
			try {
				localStorage.removeItem(`courses_${userInfo.userId}`);
				allCourses = [];
				renderCourseTable([]);
				showMessage('已清空课程', 'success');
			} catch (error) {
				showMessage('清空课程失败', 'error');
			}
		}
	});
}


// 处理文件导入
async function handleFileImport(event, customFile = null, shouldSync = false, reminderOption = 'none') {
	const file = customFile || (event?.target.files[0]);
	if (!file) return;

	if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
		showMessage('请选择JSON格式的文件', 'error');
		return;
	}

	try {
		showMessage('正在导入课程表...');

		// 读取JSON文件内容
		const fileContent = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => resolve(e.target.result);
			reader.onerror = (e) => reject(e);
			reader.readAsText(file);
		});

		// 解析JSON数据
		const jsonData = JSON.parse(fileContent);

		// 将驼峰命名转换为下划线命名
		const convertCamelToSnake = (obj) => {
			const newObj = {};
			for (let key in obj) {
				const newKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
				newObj[newKey] = obj[key];
			}
			return newObj;
		};
		// 转换数据格式
		const courseMetadatas = jsonData.map(course => convertCamelToSnake(course));
		// 导入课程数据到飞书多维表，返回创建的记录
		const importedRecords = await feishuClient.importMetadatasToCourseInfoTable(courseMetadatas);
		
		// 导入CourseRecord类和处理函数
		const { processFeishuRecords } = await import('./js/CourseRecord.js');
		
		// 直接使用导入返回的记录转换为CourseRecord对象
		const courses = processFeishuRecords(importedRecords || []);
		console.log('导入的返回数据:', importedRecords)
		console.log('导入的课程数据:', courses);

		// 更新全局课程数据
		await updateWeekView()

		// 设置当前查看周为当前周
		currentViewWeek = courseSchedule.getCurrentWeek();

		// 如果选择了同步到日程
		if (shouldSync) {
			// 过滤出没有event_id的课程（未创建日程的）
			const unscheduledCourses = courses.filter(course => !course.eventId);
			
			if (unscheduledCourses.length === 0) {
				showMessage('所有课程都已有日程，无需重复创建', 'info');
			} else {
				showMessage(`正在同步 ${unscheduledCourses.length} 门课程到飞书日程...`);
				await syncCoursesToCalendar(unscheduledCourses, reminderOption);
			}
		}

		// 根据当前周过滤并渲染
		const weekCourses = courseSchedule.filterCoursesByWeek(courses, currentViewWeek);
		renderCourseTable(weekCourses);
		updateWeekDisplay();

		if (!shouldSync) {
			showMessage(`成功导入 ${courses.length} 门课程`);
		}

		// 清空文件输入，允许重复选择同一个文件
		if (event?.target) {
			event.target.value = '';
		}

		// 重置拖放区域
		const dropZone = document.getElementById('dropZone');
		if (dropZone) {
			dropZone.innerHTML = `
        <i class="fa fa-cloud-upload"></i>
        <p>拖放文件到这里或点击选择文件</p>
        <small>支持 .json 格式文件</small>
      `;
		}
	} catch (error) {
		showMessage('导入失败: ' + error.message, 'error');
	}
}

// 加载并渲染课程（修改版：从飞书多维表拉取数据）
async function loadAndRenderCourses() {
	try {
		showMessage('正在从飞书多维表加载课程数据...');
		const userInfo = JSON.parse(localStorage.getItem('feishu_current_user'));

		// 不要在这里重新设置 currentViewWeek，保持之前设置的值
		// 只有在 currentViewWeek 为 null 时才设置
		if (currentViewWeek === null) {
			const actualCurrentWeek = courseSchedule.getCurrentWeek();
			const now = new Date();
			const dayOfWeek = now.getDay(); // 0是周日，6是周六

			// 如果是周末，默认显示下一周
			if (dayOfWeek === 0 || dayOfWeek === 6) {
				currentViewWeek = Math.min(actualCurrentWeek + 1, courseSchedule.getTotalWeeks());
			} else {
				currentViewWeek = actualCurrentWeek;
			}
		}


		// 使用用户的openId和指定周数获取课程记录
		const recordsData = await feishuClient.getCourseInfoTableMetadata(userInfo?.openId, currentViewWeek);

		// 导入CourseRecord类和处理函数
		const { processFeishuRecords } = await import('./js/CourseRecord.js');

		// 使用批量处理函数
		allCourses = processFeishuRecords(recordsData.items);


		// API已经返回了指定周的课程，直接渲染
		renderCourseTable(allCourses);
		updateWeekDisplay();
		showMessage(`第${currentViewWeek}周课程已加载`);

	} catch (error) {
		showMessage('加载课程失败: ' + error.message, 'error');
	}
}

// 课程表渲染 - 完整的周课表格式
function renderCourseTable(courses) {
	const courseTableElement = document.getElementById('courseTable');

	if (courses.length === 0) {
		courseTableElement.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-inbox"></i>
                <p>暂无课程记录</p>
            </div>
        `;
		return;
	}

	// 获取当前时间信息
	const now = new Date();
	const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // 转换周日为7
	const currentHour = now.getHours();
	const currentMinute = now.getMinutes();
	const currentTime = currentHour * 60 + currentMinute; // 转换为分钟数便于比较

	// 判断查看的周和今天的关系
	const actualCurrentWeek = courseSchedule.getCurrentWeek();
	const isViewingCurrentWeek = currentViewWeek === actualCurrentWeek;
	const isViewingFutureWeek = currentViewWeek > actualCurrentWeek;

	// 判断今天是否是工作日（周一到周五）
	const isTodayWorkday = currentDay >= 1 && currentDay <= 5;

	// 高亮条件：
	// 只在查看当前周且今天是工作日时高亮今天
	let shouldShowTodayHighlight = false;
	let highlightDay = 0; // 要高亮的星期几

	if (isViewingCurrentWeek && isTodayWorkday) {
		// 当前周且今天是工作日，高亮今天
		shouldShowTodayHighlight = true;
		highlightDay = currentDay;
	}
	// 非当前周不显示任何高亮

	// 按星期分组课程
	const coursesByDay = {
		1: [], 2: [], 3: [], 4: [], 5: []
	};

	courses.forEach(course => {
		if (course.dayOfWeek >= 1 && course.dayOfWeek <= 5) {
			coursesByDay[course.dayOfWeek].push(course);
		}
	});

	// 生成课程表HTML
	let tableHTML = `
    <div class="schedule-wrapper">
      <table class="schedule-table">
        <thead>
          <tr>
            <th class="time-column">节次</th>
            <th class="${shouldShowTodayHighlight && highlightDay === 1 ? 'today-column' : ''}" ${shouldShowTodayHighlight && highlightDay === 1 ? 'style="width: 20%;"' : ''}>
              ${shouldShowTodayHighlight && highlightDay === 1 ? '📅 ' : ''}周一
            </th>
            <th class="${shouldShowTodayHighlight && highlightDay === 2 ? 'today-column' : ''}" ${shouldShowTodayHighlight && highlightDay === 2 ? 'style="width: 20%;"' : ''}>
              ${shouldShowTodayHighlight && highlightDay === 2 ? '📅 ' : ''}周二
            </th>
            <th class="${shouldShowTodayHighlight && highlightDay === 3 ? 'today-column' : ''}" ${shouldShowTodayHighlight && highlightDay === 3 ? 'style="width: 20%;"' : ''}>
              ${shouldShowTodayHighlight && highlightDay === 3 ? '📅 ' : ''}周三
            </th>
            <th class="${shouldShowTodayHighlight && highlightDay === 4 ? 'today-column' : ''}" ${shouldShowTodayHighlight && highlightDay === 4 ? 'style="width: 20%;"' : ''}>
              ${shouldShowTodayHighlight && highlightDay === 4 ? '📅 ' : ''}周四
            </th>
            <th class="${shouldShowTodayHighlight && highlightDay === 5 ? 'today-column' : ''}" ${shouldShowTodayHighlight && highlightDay === 5 ? 'style="width: 20%;"' : ''}>
              ${shouldShowTodayHighlight && highlightDay === 5 ? '📅 ' : ''}周五
            </th>
          </tr>
        </thead>
        <tbody>
  `;

	// 获取时间段信息
	const periodInfo = courseSchedule.getPeriodInfo();

	// 只在查看当前实际周且是工作日时才找出当前正在进行的课程和下一节课
	let currentCourse = null;
	let nextCourse = null;

	if (shouldShowTodayHighlight) {
		// 今天的课程
		const todayCourses = coursesByDay[currentDay];

		// 遍历所有课程
		for (let course of todayCourses) {
			const courseStartTime = periodInfo[course.startPeriod - 1].startMinutes;
			const courseEndTime = periodInfo[course.endPeriod - 1].endMinutes;

			// 检查是否正在上课
			if (currentTime >= courseStartTime && currentTime <= courseEndTime) {
				currentCourse = course;
			}
			// 如果课程还未开始（当前时间小于课程开始时间）
			else if (currentTime < courseStartTime) {
				if (!nextCourse || courseStartTime < periodInfo[nextCourse.startPeriod - 1].startMinutes) {
					nextCourse = course;
				}
			}
		}
	}

	// 创建一个二维数组来跟踪已处理的单元格
	const processedCells = {};

	// 生成每一节课的行
	periodInfo.forEach((info, index) => {
		// 只在查看当前实际周且是工作日时检查是否是当前时间段
		const isCurrentPeriod = shouldShowTodayHighlight &&
			currentTime >= info.startMinutes &&
			currentTime <= info.endMinutes;

		let rowHTML = `<tr class="${isCurrentPeriod ? 'current-period' : ''}">`;

		// 时间列 - 不添加 current-time 类
		rowHTML += `
      <td class="time-cell">
        <div class="period-number">第${info.period}节</div>
        <div class="period-time">${info.time}</div>
      </td>
    `;

		// 每个工作日的课程
		for (let day = 1; day <= 5; day++) {
			const cellKey = `${day}-${info.period}`;

			// 如果这个单元格已经被处理（被上面的合并单元格占用），跳过
			if (processedCells[cellKey]) {
				continue;
			}

			// 查找这个时间段的课程
			const course = coursesByDay[day].find(c =>
				c.startPeriod <= info.period && c.endPeriod >= info.period
			);

			if (course && course.startPeriod === info.period) {
				// 这是课程的起始节，创建合并单元格
				const rowspan = course.endPeriod - course.startPeriod + 1;

				// 标记被占用的单元格
				for (let i = 0; i < rowspan; i++) {
					processedCells[`${day}-${course.startPeriod + i}`] = true;
				}

				// 检查是否是正在上课或下一节课（只在查看当前周且是工作日且是今天的课程中高亮）
				const isCurrentClass = shouldShowTodayHighlight && currentCourse && currentCourse === course && day === highlightDay;
				const isNextClass = shouldShowTodayHighlight && nextCourse && nextCourse === course && day === highlightDay;

				rowHTML += `
          <td class="course-cell ${shouldShowTodayHighlight && day === highlightDay ? 'today-course' : ''} ${isCurrentClass ? 'current-course-highlight' : ''} ${isNextClass ? 'next-course-highlight' : ''}" 
              rowspan="${rowspan}" 
              style="background-color: ${course.color}20; border-left: 3px solid ${course.color};">
            <div class="course-content">
              ${isCurrentClass ? '<div class="current-badge">上课中</div>' : ''}
              ${isNextClass ? '<div class="next-badge">即将开始</div>' : ''}
              <div class="course-name">${course.courseName}</div>
              <div class="course-location">${course.location}</div>
              <div class="course-details">
                <div>教师: ${course.teacher}</div>
                <div>周次: ${course.startWeek}-${course.endWeek}周</div>
                <div>节次: ${course.startPeriod}-${course.endPeriod}节</div>
                <div>时间: ${course.getTimeDescription()}</div>
              </div>
            </div>
          </td>
        `;
			} else if (!course) {
				// 空单元格
				rowHTML += `<td class="empty-cell ${shouldShowTodayHighlight && day === highlightDay ? 'today-empty' : ''}"></td>`;
			}
		}

		rowHTML += `</tr>`;

		// 在特定节次后添加分隔行
		if (info.period === 5) {
			rowHTML += `<tr class="section-divider"><td colspan="6">午休</td></tr>`;
		} else if (info.period === 9) {
			rowHTML += `<tr class="section-divider"><td colspan="6">晚餐</td></tr>`;
		}

		tableHTML += rowHTML;
	});

	tableHTML += `
        </tbody>
      </table>
    </div>
  `;

	courseTableElement.innerHTML = tableHTML;

	// 创建一个全局的悬浮详情框
	let hoverDetails = document.getElementById('hover-details');
	if (!hoverDetails) {
		hoverDetails = document.createElement('div');
		hoverDetails.id = 'hover-details';
		hoverDetails.className = 'hover-details-popup';
		hoverDetails.style.display = 'none';
		document.body.appendChild(hoverDetails);
	}

	// 添加课程悬停效果
	document.querySelectorAll('.course-cell').forEach(cell => {
		cell.addEventListener('mouseenter', function (e) {
			// 添加悬停类
			this.classList.add('course-hover');

			// 获取课程详情内容
			const details = this.querySelector('.course-details');
			if (details && hoverDetails) {
				// 复制内容到悬浮框
				hoverDetails.innerHTML = details.innerHTML;

				// 计算位置 - 显示在左侧
				const rect = this.getBoundingClientRect();
				const detailsWidth = 280;
				const detailsHeight = 150;

				// 默认显示在左侧
				let left = rect.left - detailsWidth - 20;
				let top = rect.top + rect.height / 2 - detailsHeight / 2;

				// 如果左边空间不够，显示在右侧
				if (left < 20) {
					left = rect.right + 20;
					hoverDetails.classList.add('right-bubble');
					hoverDetails.classList.remove('left-bubble');
				} else {
					hoverDetails.classList.add('left-bubble');
					hoverDetails.classList.remove('right-bubble');
				}

				// 检查上下边界
				if (top < 20) {
					top = 20;
				}
				if (top + detailsHeight > window.innerHeight - 20) {
					top = window.innerHeight - detailsHeight - 20;
				}

				// 设置悬浮框样式 - 聊天气泡风格
				hoverDetails.style.cssText = `
          display: block !important;
          left: ${left}px !important;
          top: ${top}px !important;
          position: fixed !important;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          border-radius: 18px !important;
          padding: 18px 20px !important;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.35) !important;
          z-index: 9999 !important;
          font-size: 13px !important;
          line-height: 1.8 !important;
          min-width: 250px !important;
          max-width: 300px !important;
          animation: slideInLeft 0.3s ease-out !important;
          white-space: normal !important;
        `;
			}
		});

		cell.addEventListener('mouseleave', function () {
			// 移除悬停类
			this.classList.remove('course-hover');

			// 隐藏悬浮框
			if (hoverDetails) {
				hoverDetails.style.display = 'none';
			}
		});
	});
}
// 显示消息提示
function showMessage(text, type = 'info') {
	const messageElement = document.getElementById('message');
	messageElement.textContent = text;
	messageElement.className = `message ${type}`;

	// 3秒后自动隐藏
	setTimeout(() => {
		messageElement.textContent = '';
		messageElement.className = 'message';
	}, 3000);
}

// 初始化侧边栏交互
function initSidebarInteractions() {
	const sidebar = document.getElementById('sidebar');
	const toggleBtn = document.getElementById('sidebarToggle');
	const avatarToggle = document.getElementById('avatarToggle');

	// 默认隐藏侧边栏，显示头像（不需要添加类，CSS默认就是隐藏的）
	if (avatarToggle) {
		avatarToggle.style.display = 'flex';
	}

	// 点击关闭按钮收起侧边栏
	toggleBtn?.addEventListener('click', () => {
		if (sidebar && avatarToggle) {
			// 获取侧边栏中的头像元素
			const sidebarAvatar = document.getElementById('userAvatar');
			const miniAvatar = document.getElementById('miniAvatar');

			if (sidebarAvatar && sidebarAvatar.src) {
				// 确保miniAvatar也有相同的src
				if (miniAvatar) {
					miniAvatar.src = sidebarAvatar.src;
				}

				// 获取侧边栏头像的位置
				const sidebarAvatarRect = sidebarAvatar.getBoundingClientRect();

				// 先设置真正的头像位置但不显示
				avatarToggle.style.opacity = '0';
				avatarToggle.style.display = 'flex';

				// 创建一个临时头像进行动画
				const tempAvatar = document.createElement('img');
				tempAvatar.src = sidebarAvatar.src;
				tempAvatar.style.cssText = `
          position: fixed;
          width: 45px;
          height: 45px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          z-index: 9999;
          left: ${sidebarAvatarRect.left}px;
          top: ${sidebarAvatarRect.top}px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        `;
				document.body.appendChild(tempAvatar);

				// 关闭侧边栏
				sidebar.classList.remove('show');

				// 强制重排，确保初始位置被应用
				tempAvatar.offsetHeight;

				// 移动到目标位置
				tempAvatar.style.left = '20px';
				tempAvatar.style.top = '15px';
				tempAvatar.style.border = '3px solid #667eea';

				// 动画完成时，直接切换到真正的头像
				setTimeout(() => {
					// 移除临时头像
					if (tempAvatar && tempAvatar.parentNode) {
						document.body.removeChild(tempAvatar);
					}
					// 显示真正的头像
					avatarToggle.style.opacity = '1';
				}, 400);
			} else {
				// 如果没有头像，使用原来的方式
				sidebar.classList.remove('show');
				setTimeout(() => {
					avatarToggle.style.display = 'flex';
					avatarToggle.style.opacity = '1';
				}, 300);
			}
		}
	});

	// 点击头像展开侧边栏
	avatarToggle?.addEventListener('click', () => {
		if (sidebar && avatarToggle) {
			const miniAvatar = document.getElementById('miniAvatar');
			const sidebarAvatar = document.getElementById('userAvatar');

			if (miniAvatar && miniAvatar.src && sidebarAvatar) {
				// 获取小头像的初始位置
				const miniAvatarRect = avatarToggle.getBoundingClientRect();

				// 创建一个临时头像进行缩小动画
				const shrinkAvatar = document.createElement('img');
				shrinkAvatar.src = miniAvatar.src;
				shrinkAvatar.style.cssText = `
          position: fixed;
          width: 45px;
          height: 45px;
          border-radius: 50%;
          border: 3px solid #667eea;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          z-index: 9999;
          left: ${miniAvatarRect.left}px;
          top: ${miniAvatarRect.top}px;
          transform: scale(1);
          opacity: 1;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        `;
				document.body.appendChild(shrinkAvatar);

				// 立即隐藏原始头像按钮
				avatarToggle.style.display = 'none';

				// 开始缩小动画
				setTimeout(() => {
					shrinkAvatar.style.transform = 'scale(0)';
					shrinkAvatar.style.opacity = '0';
				}, 10);

				// 缩小动画完成后，展开侧边栏并显示新头像
				setTimeout(() => {
					// 移除缩小的头像
					if (shrinkAvatar && shrinkAvatar.parentNode) {
						document.body.removeChild(shrinkAvatar);
					}

					// 先隐藏侧边栏的头像，避免闪烁
					sidebarAvatar.style.opacity = '0';

					// 展开侧边栏
					sidebar.classList.add('show');

					// 获取侧边栏头像的目标位置
					setTimeout(() => {
						const targetRect = sidebarAvatar.getBoundingClientRect();

						// 创建一个新的临时头像从小到大出现
						const growAvatar = document.createElement('img');
						growAvatar.src = sidebarAvatar.src;
						growAvatar.style.cssText = `
              position: fixed;
              width: 45px;
              height: 45px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
              z-index: 9999;
              left: ${targetRect.left}px;
              top: ${targetRect.top}px;
              transform: scale(0);
              opacity: 0;
              transition: all 1s cubic-bezier(0.34, 1.56, 0.64, 1);
            `;
						document.body.appendChild(growAvatar);

						// 开始放大动画
						setTimeout(() => {
							growAvatar.style.transform = 'scale(1)';
							growAvatar.style.opacity = '1';
						}, 10);

						// 动画完成后，显示真正的头像并移除临时头像
						setTimeout(() => {
							sidebarAvatar.style.opacity = '1';
							if (growAvatar && growAvatar.parentNode) {
								document.body.removeChild(growAvatar);
							}
						}, 300);
					}, 50);
				}, 150); // 缩短到150ms，匹配0.15s的动画时长
			} else {
				// 如果没有头像，直接展开
				sidebar.classList.add('show');
				avatarToggle.style.display = 'none';
			}
		}
	});

	// 绑定刷新按钮
	const refreshBtn = document.getElementById('refreshCourses');
	refreshBtn?.addEventListener('click', async () => {
		// 重置为当前周
		currentViewWeek = null;
		await loadAndRenderCourses();
		updateWeekNavigationButtons();
		showMessage('课程数据已刷新', 'success');
	});
}

// 显示导入对话框
function showImportDialog() {
	const dialog = document.getElementById('importDialog');
	dialog.style.display = 'flex';
}

// 关闭导入对话框
function closeImportDialog() {
	const dialog = document.getElementById('importDialog');
	dialog.style.display = 'none';
	// 重置拖放区域样式
	const dropZone = document.getElementById('dropZone');
	dropZone.classList.remove('drag-over');
	dropZone.innerHTML = `
		<i class="fa fa-cloud-upload"></i>
		<p>拖放文件到这里或点击选择文件</p>
		<small>支持 .json 格式文件</small>
	`;
	// 重置文件输入
	const fileInput = document.getElementById('courseFile');
	if (fileInput) {
		fileInput.value = '';
	}
	// 重置同步选项
	const syncCalendarCheckbox = document.getElementById('syncCalendar');
	if (syncCalendarCheckbox) {
		syncCalendarCheckbox.checked = false;
	}
	// 隐藏提醒选项
	const reminderOptions = document.getElementById('reminderOptions');
	if (reminderOptions) {
		reminderOptions.style.display = 'none';
	}
	// 重置提醒选项为默认值
	const defaultReminder = document.querySelector('input[name="reminder"][value="none"]');
	if (defaultReminder) {
		defaultReminder.checked = true;
	}
}

// 初始化导入对话框
function initImportDialog() {
	const dialog = document.getElementById('importDialog');
	const dropZone = document.getElementById('dropZone');
	const closeBtn = document.getElementById('closeImportDialog');
	const cancelBtn = document.getElementById('cancelImport');
	const confirmBtn = document.getElementById('confirmImport');
	const syncCalendarCheckbox = document.getElementById('syncCalendar');
	const reminderOptions = document.getElementById('reminderOptions');

	// 关闭按钮事件
	closeBtn?.addEventListener('click', closeImportDialog);
	cancelBtn?.addEventListener('click', closeImportDialog);

	// 同步日程复选框变化事件
	syncCalendarCheckbox?.addEventListener('change', (e) => {
		if (e.target.checked) {
			reminderOptions.style.display = 'block';
			// 添加淡入动画
			reminderOptions.style.opacity = '0';
			setTimeout(() => {
				reminderOptions.style.transition = 'opacity 0.3s ease';
				reminderOptions.style.opacity = '1';
			}, 10);
		} else {
			// 淡出动画
			reminderOptions.style.transition = 'opacity 0.3s ease';
			reminderOptions.style.opacity = '0';
			setTimeout(() => {
				reminderOptions.style.display = 'none';
			}, 300);
		}
	});

	// 确认导入按钮事件
	confirmBtn?.addEventListener('click', async () => {
		const fileInput = document.getElementById('courseFile');
		const file = fileInput.files[0];
		if (!file) {
			showMessage('请选择文件', 'error');
			return;
		}

		// 获取是否同步到日程的选项
		const shouldSync = document.getElementById('syncCalendar').checked;

		// 获取提醒选项
		let reminderOption = 'none';
		if (shouldSync) {
			const reminderSelect = document.querySelector('select[name="reminder"]');
			reminderOption = reminderSelect ? reminderSelect.value : 'none';
		}

		await handleFileImport(null, file, shouldSync, reminderOption);
		closeImportDialog();
	});

	// 拖放区域点击事件
	dropZone?.addEventListener('click', () => {
		document.getElementById('courseFile')?.click();
	});

	// 文件选择变化事件
	document.getElementById('courseFile')?.addEventListener('change', (event) => {
		const file = event.target.files[0];
		if (file) {
			dropZone.innerHTML = `
        <i class="fa fa-file"></i>
        <p>${file.name}</p>
      `;
		}
	});

	// 拖放相关事件
	dropZone?.addEventListener('dragover', (e) => {
		e.preventDefault();
		dropZone.classList.add('drag-over');
	});

	dropZone?.addEventListener('dragleave', () => {
		dropZone.classList.remove('drag-over');
	});

	dropZone?.addEventListener('drop', (e) => {
		e.preventDefault();
		dropZone.classList.remove('drag-over');

		const file = e.dataTransfer.files[0];
		if (file) {
			if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
				showMessage('请选择JSON格式的文件', 'error');
				return;
			}

			const fileInput = document.getElementById('courseFile');
			fileInput.files = e.dataTransfer.files;
			dropZone.innerHTML = `
        <i class="fa fa-file"></i>
        <p>${file.name}</p>
      `;
		}
	});

	// 点击对话框外部区域关闭
	dialog?.addEventListener('click', (e) => {
		if (e.target === dialog) {
			closeImportDialog();
		}
	});
}

// 处理课程同步到日程
async function syncCoursesToCalendar(courses, reminderOption = 'none') {
	// 导入CalendarSync类
	const { CalendarSync } = await import('./js/CalendarSync.js');
	const calendarSync = new CalendarSync(feishuClient);

	// 显示进度对话框
	const progressDialog = document.getElementById('syncProgressDialog');
	const progressBarFill = document.getElementById('progressBarFill');
	const progressText = document.getElementById('progressText');
	const progressDetails = document.getElementById('progressDetails');

	progressDialog.style.display = 'flex';

	try {
		// 同步课程到日历
		const result = await calendarSync.syncCoursesToCalendar(
			courses,
			reminderOption,
			(progress) => {
				// 更新进度条
				const percentage = Math.round((progress.current / progress.total) * 100);
				progressBarFill.style.width = `${percentage}%`;
				progressText.textContent = `正在同步 (${progress.current}/${progress.total})`;
				progressDetails.textContent = `正在处理: ${progress.courseName}`;
			}
		);

		// 隐藏进度对话框
		setTimeout(() => {
			progressDialog.style.display = 'none';
		}, 500);

		// 显示同步结果
		const skippedCount = result.skipped ? result.skipped.length : 0;
		
		if (result.failed.length > 0 || skippedCount > 0) {
			let message = `同步完成：成功 ${result.success.length} 门`;
			if (result.failed.length > 0) {
				message += `，失败 ${result.failed.length} 门`;
			}
			if (skippedCount > 0) {
				message += `，跳过 ${skippedCount} 门(已存在)`;
			}
			
			showMessage(message, result.failed.length > 0 ? 'warning' : 'info');
			
			if (result.failed.length > 0) {
				console.error('同步失败的课程:', result.failed);
			}
			if (skippedCount > 0) {
				console.log('跳过的课程:', result.skipped);
			}
		} else {
			showMessage(
				`成功同步 ${result.success.length} 门课程到飞书日程`,
				'success'
			);
		}

		return result;

	} catch (error) {
		// 隐藏进度对话框
		progressDialog.style.display = 'none';

		showMessage('同步到日程失败: ' + error.message, 'error');
		throw error;
	}
}

// 更新日期时间显示
function updateDateTime() {
	const updateTime = () => {
		const now = new Date();
		const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
		const weekNum = Math.ceil((now - new Date(now.getFullYear(), 8, 1)) / (7 * 24 * 60 * 60 * 1000));

		const currentWeekEl = document.getElementById('currentWeek');
		const currentTimeEl = document.getElementById('currentTime');

		if (currentWeekEl) {
			currentWeekEl.textContent = `第${weekNum}周 | 周${weekDays[now.getDay()]}`;
		}

		if (currentTimeEl) {
			currentTimeEl.textContent = now.toLocaleTimeString('zh-CN', {
				hour: '2-digit',
				minute: '2-digit'
			});
		}
	};

	updateTime();
	setInterval(updateTime, 1000);
}

// 初始化周导航功能
function initWeekNavigation() {
	const prevBtn = document.getElementById('prevWeekBtn');
	const nextBtn = document.getElementById('nextWeekBtn');
	const currentBtn = document.getElementById('currentWeekBtn');

	// 上一周按钮
	prevBtn?.addEventListener('click', async () => {
		if (currentViewWeek > 1) {
			currentViewWeek--;
			await updateWeekView();
		}
	});

	// 下一周按钮
	nextBtn?.addEventListener('click', async () => {
		if (currentViewWeek < courseSchedule.getTotalWeeks()) {
			currentViewWeek++;
			await updateWeekView();
		}
	});

	// 回到当前周按钮
	currentBtn?.addEventListener('click', async () => {
		currentViewWeek = courseSchedule.getCurrentWeek();
		await updateWeekView();
	});
}

// 更新周视图
async function updateWeekView() {
	// 每次切换周都重新从飞书获取数据

	try {
		showMessage(`正在加载第${currentViewWeek}周课程...`);

		// 从飞书获取指定周的课程数据
		const userInfo = JSON.parse(localStorage.getItem('feishu_current_user'));
		const recordsData = await feishuClient.getCourseInfoTableMetadata(userInfo?.openId, currentViewWeek);

		// 导入CourseRecord类和处理函数
		const { processFeishuRecords } = await import('./js/CourseRecord.js');

		// 处理数据
		allCourses = processFeishuRecords(recordsData.items);

		// 这里不需要再过滤了，因为API已经返回了指定周的课程
		renderCourseTable(allCourses);
		updateWeekDisplay();
		updateWeekNavigationButtons();

		showMessage(`第${currentViewWeek}周已加载`);
	} catch (error) {
		showMessage('加载课程失败: ' + error.message, 'error');
	}
}

// 更新周显示信息
function updateWeekDisplay() {
	const weekNumberEl = document.getElementById('weekNumber');
	const weekDateRangeEl = document.getElementById('weekDateRange');
	const currentWeekBtnEl = document.getElementById('currentWeekBtn');

	if (weekNumberEl) {
		weekNumberEl.textContent = `第${currentViewWeek}周`;
	}

	if (weekDateRangeEl) {
		const dateRange = courseSchedule.getWeekDateRange(currentViewWeek);
		const startStr = dateRange.start.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
		const endStr = dateRange.end.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
		weekDateRangeEl.textContent = `(${startStr} - ${endStr})`;
	}

	// 如果是当前周，隐藏"本周"按钮
	const actualCurrentWeek = courseSchedule.getCurrentWeek();
	if (currentWeekBtnEl) {
		if (currentViewWeek === actualCurrentWeek) {
			currentWeekBtnEl.style.display = 'none';
		} else {
			currentWeekBtnEl.style.display = 'inline-flex';
		}
	}
}

// 更新周导航按钮状态
function updateWeekNavigationButtons() {
	const prevBtn = document.getElementById('prevWeekBtn');
	const nextBtn = document.getElementById('nextWeekBtn');

	// 检查边界，禁用相应按钮
	if (prevBtn) {
		prevBtn.disabled = currentViewWeek <= 1;
		prevBtn.style.opacity = currentViewWeek <= 1 ? '0.5' : '1';
		prevBtn.style.cursor = currentViewWeek <= 1 ? 'not-allowed' : 'pointer';
	}

	if (nextBtn) {
		const totalWeeks = courseSchedule.getTotalWeeks();
		nextBtn.disabled = currentViewWeek >= totalWeeks;
		nextBtn.style.opacity = currentViewWeek >= totalWeeks ? '0.5' : '1';
		nextBtn.style.cursor = currentViewWeek >= totalWeeks ? 'not-allowed' : 'pointer';
	}
}

// 显示创建全部日程对话框
async function showSyncAllDialog() {
	try {
		showMessage('正在加载全部课程...');
		
		// 获取全部课程
		const recordsData = await feishuClient.getAllUserCourses();
		const { processFeishuRecords } = await import('./js/CourseRecord.js');
		const allCourses = processFeishuRecords(recordsData.items || []);
		
		// 过滤出没有event_id的课程（未创建日程的）
		const unscheduledCourses = allCourses.filter(course => !course.eventId);
		
		if (unscheduledCourses.length === 0) {
			showMessage('所有课程都已创建日程', 'info');
			return;
		}
		
		// 生成课程列表HTML
		const courseListHTML = unscheduledCourses.map((course, index) => `
			<div class="course-check-item" style="padding: 10px; border-bottom: 1px solid #f0f0f0;">
				<label class="checkbox-label" style="display: flex; align-items: center;">
					<input type="checkbox" class="course-checkbox" data-index="${index}" checked>
					<div style="margin-left: 10px;">
						<div style="font-weight: 500;">${course.courseName}</div>
						<div style="font-size: 12px; color: #666;">
							${course.teacher || ''} | ${course.location || ''} | 
							周${course.dayOfWeek} 第${course.startPeriod}-${course.endPeriod}节 | 
							第${course.startWeek}-${course.endWeek}周
						</div>
					</div>
				</label>
			</div>
		`).join('');
		
		document.getElementById('courseCheckList').innerHTML = courseListHTML;
		
		// 显示对话框
		const dialog = document.getElementById('syncAllDialog');
		dialog.style.display = 'flex';
		
		// 全选功能
		const selectAllCheckbox = document.getElementById('selectAllCourses');
		selectAllCheckbox.addEventListener('change', (e) => {
			const checkboxes = document.querySelectorAll('.course-checkbox');
			checkboxes.forEach(cb => cb.checked = e.target.checked);
		});
		
		// 监听单个复选框变化，更新全选状态
		document.querySelectorAll('.course-checkbox').forEach(checkbox => {
			checkbox.addEventListener('change', () => {
				const allCheckboxes = document.querySelectorAll('.course-checkbox');
				const checkedCheckboxes = document.querySelectorAll('.course-checkbox:checked');
				
				// 如果所有复选框都选中，全选框也选中
				// 如果有任何一个未选中，全选框取消选中
				selectAllCheckbox.checked = allCheckboxes.length === checkedCheckboxes.length;
				
				// 如果有部分选中但不是全部，设置不确定状态（如果支持）
				if (checkedCheckboxes.length > 0 && checkedCheckboxes.length < allCheckboxes.length) {
					selectAllCheckbox.indeterminate = true;
				} else {
					selectAllCheckbox.indeterminate = false;
				}
			});
		});
		
		// 关闭按钮
		document.getElementById('closeSyncAllDialog').addEventListener('click', () => {
			dialog.style.display = 'none';
		});
		
		document.getElementById('cancelSyncAll').addEventListener('click', () => {
			dialog.style.display = 'none';
		});
		
		// 确认创建
		document.getElementById('confirmSyncAll').addEventListener('click', async () => {
			// 获取选中的课程
			const selectedIndexes = Array.from(document.querySelectorAll('.course-checkbox:checked'))
				.map(cb => parseInt(cb.dataset.index));
			
			if (selectedIndexes.length === 0) {
				showMessage('请至少选择一门课程', 'warning');
				return;
			}
			
			const selectedCourses = selectedIndexes.map(i => unscheduledCourses[i]);
			const reminderOption = document.querySelector('select[name="batchReminder"]').value;
			
			// 关闭对话框
			dialog.style.display = 'none';
			
			// 同步选中的课程
			await syncCoursesToCalendar(selectedCourses, reminderOption);
		});
		
		showMessage(`找到 ${unscheduledCourses.length} 门未创建日程的课程`, 'success');
		
	} catch (error) {
		showMessage('加载课程失败: ' + error.message, 'error');
	}
}

// 删除课程日历
async function deleteCourseCalendar() {
	try {
		// 获取存储的日历ID
		const calendarId = localStorage.getItem('course_calendar_id');
		if (!calendarId) {
			showMessage('未找到课程日历', 'warning');
			return;
		}
		
		showMessage('正在删除日历和清空记录...');
		
		// 1. 调用删除日历API
		try {
			await feishuClient.delete(`/calendar/v4/calendars/${calendarId}`);
		} catch (error) {
			console.log('删除日历失败，可能日历已不存在:', error);
		}
		
		// 2. 清除本地存储的日历ID
		localStorage.removeItem('course_calendar_id');
		
		// 3. 使用CalendarSync类的批量清空方法
		try {
			// 导入CalendarSync类
			const { CalendarSync } = await import('./js/CalendarSync.js');
			const calendarSync = new CalendarSync(feishuClient);
			
			// 批量清空所有event_id
			const result = await calendarSync.clearAllCourseEventIds();
			
			if (result.total > 0) {
				showMessage(
					`已清空 ${result.success}/${result.total} 条课程的日程ID` + 
					(result.failed > 0 ? `，${result.failed} 条失败` : ''), 
					result.failed > 0 ? 'warning' : 'info'
				);
			}
		} catch (error) {
			console.error('清空数据库event_id失败:', error);
			showMessage('清空日程ID失败，但日历已删除', 'warning');
		}
		
		// 4. 刷新当前页面的数据
		await updateWeekView();
		
		showMessage('课程日历已删除，所有日程ID已清空', 'success');
	} catch (error) {
		console.error('删除日历失败:', error);
		throw error;
	}
}

// 加载课程管理页面
async function loadCourseManagement() {
	try {
		showMessage('正在加载课程列表...', 'info');
		
		// 获取所有课程（不限周数）
		const recordsData = await feishuClient.getAllUserCourses();
		const { processFeishuRecords } = await import('./js/CourseRecord.js');
		const allCourses = processFeishuRecords(recordsData.items || []);
		
		// 渲染课程列表
		renderCourseManagement(allCourses);
		
		showMessage(`已加载 ${allCourses.length} 门课程`, 'success');
	} catch (error) {
		showMessage('加载课程失败: ' + error.message, 'error');
	}
}

// 渲染课程管理列表
function renderCourseManagement(courses) {
	const courseListElement = document.getElementById('courseList');
	
	if (!courses || courses.length === 0) {
		courseListElement.innerHTML = `
			<div class="empty-state" style="text-align: center; padding: 60px 20px;">
				<i class="fa fa-inbox" style="font-size: 48px; color: #999; margin-bottom: 20px;"></i>
				<h3 style="color: #666; margin-bottom: 10px;">暂无课程数据</h3>
				<p style="color: #999;">请先导入课程表</p>
			</div>
		`;
		return;
	}
	
	// 按周分组课程
	const coursesByWeek = {};
	courses.forEach(course => {
		for (let week = course.startWeek; week <= course.endWeek; week++) {
			if (!coursesByWeek[week]) {
				coursesByWeek[week] = [];
			}
			coursesByWeek[week].push(course);
		}
	});
	
	// 统计信息
	const totalCourses = courses.length;
	const syncedCourses = courses.filter(c => c.eventId).length;
	const unsyncedCourses = totalCourses - syncedCourses;
	
	// 生成改进的UI
	const courseCards = courses.map((course, index) => {
		const hasEvent = course.eventId ? true : false;
		const dayNames = ['', '周一', '周二', '周三', '周四', '周五'];
		
		return `
			<div class="course-card" style="
				border: 1px solid ${hasEvent ? '#e8f5e9' : '#fff3e0'};
				border-radius: 12px;
				padding: 20px;
				margin-bottom: 16px;
				background: white;
				box-shadow: 0 2px 8px rgba(0,0,0,0.08);
				transition: all 0.3s ease;
				position: relative;
				overflow: hidden;
			" 
			onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'; this.style.transform='translateY(-2px)'"
			onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'; this.style.transform='translateY(0)'">
				<!-- 状态指示条 -->
				<div style="
					position: absolute;
					top: 0;
					left: 0;
					width: 4px;
					height: 100%;
					background: ${hasEvent ? '#4caf50' : '#ff9800'};
				"></div>
				
				<div style="display: flex; justify-content: space-between; align-items: start;">
					<div style="flex: 1; padding-left: 12px;">
						<!-- 课程名称和代码 -->
						<div style="margin-bottom: 12px;">
							<h3 style="margin: 0; color: #333; font-size: 18px; font-weight: 600;">
								${course.courseName}
							</h3>
							${course.courseCode ? `
								<span style="
									display: inline-block;
									margin-top: 6px;
									padding: 2px 8px;
									background: #f5f5f5;
									border-radius: 4px;
									font-size: 12px;
									color: #666;
								">${course.courseCode}</span>
							` : ''}
						</div>
						
						<!-- 课程详细信息网格 -->
						<div style="
							display: grid;
							grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
							gap: 12px;
							margin-bottom: 12px;
						">
							<div style="display: flex; align-items: center; color: #666; font-size: 14px;">
								<i class="fa fa-user-o" style="width: 20px; color: #999;"></i>
								<span>教师: ${course.teacher || '未指定'}</span>
							</div>
							<div style="display: flex; align-items: center; color: #666; font-size: 14px;">
								<i class="fa fa-map-marker" style="width: 20px; color: #999;"></i>
								<span>地点: ${course.location || '未指定'}</span>
							</div>
							<div style="display: flex; align-items: center; color: #666; font-size: 14px;">
								<i class="fa fa-calendar-o" style="width: 20px; color: #999;"></i>
								<span>${dayNames[course.dayOfWeek]} 第${course.startPeriod}-${course.endPeriod}节</span>
							</div>
							<div style="display: flex; align-items: center; color: #666; font-size: 14px;">
								<i class="fa fa-clock-o" style="width: 20px; color: #999;"></i>
								<span>第${course.startWeek}-${course.endWeek}周</span>
							</div>
						</div>
						
						${course.studentName ? `
							<div style="
								padding-top: 12px;
								border-top: 1px solid #f0f0f0;
								font-size: 13px;
								color: #999;
							">
								<i class="fa fa-graduation-cap" style="margin-right: 6px;"></i>
								学生: ${course.studentName}
							</div>
						` : ''}
					</div>
					
					<!-- 操作区域 -->
					<div style="
						display: flex;
						flex-direction: column;
						align-items: center;
						gap: 12px;
						padding-left: 20px;
					">
						<!-- 同步状态 -->
						<div style="
							padding: 6px 12px;
							border-radius: 20px;
							font-size: 12px;
							font-weight: 500;
							white-space: nowrap;
							${hasEvent ? 
								'background: #e8f5e9; color: #2e7d32;' : 
								'background: #fff3e0; color: #f57c00;'}
						">
							<i class="fa ${hasEvent ? 'fa-check-circle' : 'fa-exclamation-circle'}" 
								style="margin-right: 4px;"></i>
							${hasEvent ? '已同步' : '未同步'}
						</div>
						
						<!-- 操作按钮 -->
						<button class="course-action-btn" 
							data-index="${index}"
							data-has-event="${hasEvent}"
							style="
								padding: 8px 16px;
								border: none;
								border-radius: 8px;
								font-size: 14px;
								font-weight: 500;
								cursor: pointer;
								transition: all 0.3s;
								white-space: nowrap;
								${hasEvent ? 
									'background: #ffebee; color: #c62828;' : 
									'background: #e3f2fd; color: #1565c0;'}
							"
							onmouseover="this.style.transform='scale(1.05)'"
							onmouseout="this.style.transform='scale(1)'"
						>
							<i class="fa ${hasEvent ? 'fa-calendar-times-o' : 'fa-calendar-plus-o'}" 
								style="margin-right: 6px;"></i>
							${hasEvent ? '取消订阅' : '订阅日程'}
						</button>
					</div>
				</div>
			</div>
		`;
	}).join('');
	
	courseListElement.innerHTML = `
		<div style="padding: 20px;">
			<!-- 简洁的统计信息 -->
			<div style="
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: 20px;
				padding: 16px;
				background: #f5f5f5;
				border-radius: 8px;
				font-size: 14px;
			">
				<div style="display: flex; gap: 24px;">
					<span>共 <strong style="color: #667eea; font-size: 18px;">${totalCourses}</strong> 门课程</span>
					<span style="color: #4caf50;">已同步 <strong style="font-size: 18px;">${syncedCourses}</strong></span>
					<span style="color: #ff9800;">未同步 <strong style="font-size: 18px;">${unsyncedCourses}</strong></span>
				</div>
				<div style="color: #666;">
					<i class="fa fa-info-circle" style="margin-right: 4px;"></i>
					点击按钮管理日程订阅
				</div>
			</div>
			
			<!-- 课程列表 -->
			<div class="course-management-list" style="max-height: calc(100vh - 200px); overflow-y: auto;">
				${courseCards}
			</div>
		</div>
	`;
	
	// 绑定订阅/取消订阅事件
	document.querySelectorAll('.course-action-btn').forEach(btn => {
		btn.addEventListener('click', async (e) => {
			e.stopPropagation();
			const index = parseInt(btn.dataset.index);
			const hasEvent = btn.dataset.hasEvent === 'true';
			const course = courses[index];
			
			// 添加加载状态
			btn.disabled = true;
			btn.innerHTML = hasEvent ? 
				'<i class="fa fa-spinner fa-spin"></i> 处理中...' : 
				'<i class="fa fa-spinner fa-spin"></i> 处理中...';
			
			try {
				if (hasEvent) {
					// 取消订阅（删除日程）
					await unsubscribeCourse(course);
				} else {
					// 订阅日程
					await subscribeCourse(course);
				}
				
				// 刷新页面
				await loadCourseManagement();
			} catch (error) {
				// 恢复按钮状态
				btn.disabled = false;
				btn.innerHTML = hasEvent ? 
					'<i class="fa fa-calendar-times-o" style="margin-right: 6px;"></i>取消订阅' : 
					'<i class="fa fa-calendar-plus-o" style="margin-right: 6px;"></i>订阅日程';
			}
		});
	});
}

// 订阅单个课程到日历
async function subscribeCourse(course) {
	try {
		showMessage(`正在订阅课程: ${course.courseName}...`, 'info');
		
		// 初始化CalendarSync
		const { CalendarSync } = await import('./js/CalendarSync.js');
		const calendarSync = new CalendarSync(feishuClient);
		
		// 同步单个课程，默认不提醒
		await calendarSync.syncCoursesToCalendar([course], 'none');
		
		showMessage(`课程 ${course.courseName} 已成功订阅`, 'success');
	} catch (error) {
		showMessage(`订阅失败: ${error.message}`, 'error');
	}
}

// 取消订阅课程（删除日程）
async function unsubscribeCourse(course) {
	try {
		if (!course.eventId) {
			showMessage('该课程未创建日程', 'warning');
			return;
		}
		
		// 确认删除
		if (!confirm(`确定要取消订阅课程 "${course.courseName}" 的日程吗？`)) {
			return;
		}
		
		showMessage(`正在取消订阅: ${course.courseName}...`, 'info');
		
		// 初始化CalendarSync
		const { CalendarSync } = await import('./js/CalendarSync.js');
		const calendarSync = new CalendarSync(feishuClient);
		
		// 删除课程日程
		await calendarSync.deleteCourseEvent(course.eventId, course.recordId);
		
		showMessage(`课程 ${course.courseName} 的日程已删除`, 'success');
	} catch (error) {
		showMessage(`取消订阅失败: ${error.message}`, 'error');
	}
}