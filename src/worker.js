// Cloudflare Worker 入口文件 - 处理所有后端逻辑和静态资源

// CORS 响应头配置
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Access-Control-Max-Age': '86400',
};

// 处理 OPTIONS 预检请求
async function handleOptions(request) {
	return new Response(null, {
		status: 204,
		headers: corsHeaders
	});
}

// 用code兑换token的处理函数
async function handleExchangeToken(request, env) {
	try {
		const { code, redirectUri, codeVerifier } = await request.json();

		const tokenParams = {
			grant_type: 'authorization_code',
			client_id: env.VITE_FEISHU_APP_ID,
			client_secret: env.VITE_FEISHU_APP_SECRET,
			code: code,
			redirect_uri: redirectUri,
			code_verifier: codeVerifier
		};

		const response = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify(tokenParams)
		});

		const data = await response.json();

		if (!response.ok || data.error) {
			throw new Error(data.error_description || data.error || '兑换token失败');
		}

		return new Response(JSON.stringify({
			code: 0,
			access_token: data.access_token,
			refresh_token: data.refresh_token,
			expires_in: data.expires_in,
			token_type: data.token_type || 'Bearer'
		}), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			}
		});

	} catch (error) {
		console.error('兑换token失败:', error);
		return new Response(JSON.stringify({
			message: '兑换token失败：' + error.message
		}), {
			status: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			}
		});
	}
}

// 刷新token的处理函数
async function handleRefreshToken(request, env) {
	try {
		const { refreshToken } = await request.json();

		const refreshParams = {
			grant_type: 'refresh_token',
			client_id: env.VITE_FEISHU_APP_ID,
			client_secret: env.VITE_FEISHU_APP_SECRET,
			refresh_token: refreshToken
		};

		const response = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify(refreshParams)
		});

		const data = await response.json();

		if (!response.ok || data.error) {
			throw new Error(data.error_description || data.error || '刷新token失败');
		}

		return new Response(JSON.stringify({
			code: 0,
			access_token: data.access_token,
			refresh_token: data.refresh_token,
			expires_in: data.expires_in
		}), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			}
		});

	} catch (error) {
		console.error('刷新token失败:', error);
		return new Response(JSON.stringify({
			message: '刷新token失败：' + error.message
		}), {
			status: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			}
		});
	}
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const method = request.method;

		// 处理 OPTIONS 预检请求
		if (method === 'OPTIONS') {
			return handleOptions(request);
		}

		// 处理后端 API 路由
		if (url.pathname === '/proxy-api/feishu/exchange-token' && method === 'POST') {
			return handleExchangeToken(request, env);
		}
		
		if (url.pathname === '/proxy-api/feishu/refresh-token' && method === 'POST') {
			return handleRefreshToken(request, env);
		}

		// 代理飞书 API 请求（带 Bearer token 的请求）
		if (url.pathname.startsWith('/feishu-api/')) {
			const targetPath = url.pathname.replace('/feishu-api', '');
			const targetUrl = `https://open.feishu.cn/open-apis${targetPath}${url.search}`;
			
			const modifiedRequest = new Request(targetUrl, {
				method: request.method,
				headers: request.headers,
				body: request.body
			});
			
			return fetch(modifiedRequest);
		}

		// 处理环境变量配置请求（供前端获取配置）
		if (url.pathname === '/api/config') {
			return new Response(JSON.stringify({
				VITE_FEISHU_APP_ID: env.VITE_FEISHU_APP_ID,
				VITE_FEISHU_REDIRECT_URI: env.VITE_FEISHU_REDIRECT_URI,
				VITE_FEISHU_DATABASE_ID: env.VITE_FEISHU_DATABASE_ID
			}), {
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders 
				}
			});
		}

		// 健康检查
		if (url.pathname === '/health') {
			return new Response(JSON.stringify({
				code: 0,
				message: 'Service is healthy',
				timestamp: new Date().toISOString()
			}), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				}
			});
		}
		
		// 返回静态资源
		return env.ASSETS.fetch(request);
	}
}