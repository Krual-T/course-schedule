// 应用初始化文件 - 纯前端代码
import { initFeishuClient } from './js/FeishuClient.js';
import { courseSchedule } from './js/CourseSchedule.js';
import './css/dialog.css';

// 全局变量存储 feishuClient 实例
let feishuClient = null;

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
                                    </div>
                                </div>
                                <div class="dialog-footer">
                                    <button class="dialog-btn secondary" id="cancelImport">取消</button>
                                    <button class="dialog-btn primary" id="confirmImport">导入</button>
                                </div>
                            </div>
                        </div>
                        
                        <button id="refreshCourses" class="sidebar-btn">
                            <i class="fa fa-refresh"></i>
                            <span class="sidebar-text">刷新数据</span>
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
                <div class="top-bar-left">
                    <h1 class="page-title">
                        <i class="fa fa-calendar"></i> 我的课程表
                    </h1>
                </div>
                <div class="top-bar-right">
                    <span id="currentWeek" class="current-week"></span>
                    <span id="currentTime" class="current-time"></span>
                </div>
            </header>
            
            <!-- 课程表内容 -->
            <main class="content-area">
                <div id="courseTable" class="course-table-container"></div>
                
                <!-- 空状态 -->
                <div id="emptyState" class="empty-state" style="display: none;">
                    <i class="fa fa-calendar-o"></i>
                    <h3>暂无课程数据</h3>
                    <p>请先导入课程表</p>
                </div>
            </main>
        </div>
        
        <!-- 消息提示 -->
        <div id="message" class="message"></div>
    </div>
    `;

	// 初始化侧边栏交互
	initSidebarInteractions();
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
		console.error('检查登录状态失败:', error);
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
		console.error('授权失败:', error);
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
		'base:record:retrieve', 'bitable:app'
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

	// 初始化导入对话框
	initImportDialog();

	// 添加清空课程事件
	document.getElementById('deleteCourses')?.addEventListener('click', async () => {
		if (confirm('确定要清空所有课程吗？')) {
			try {
				localStorage.removeItem(`courses_${userInfo.userId}`);
				renderCourseTable([]);
				showMessage('已清空课程', 'success');
			} catch (error) {
				showMessage('清空课程失败', 'error');
			}
		}
	});
}


// 处理文件导入
async function handleFileImport(event, customFile = null, shouldSync = false) {
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
		// 导入课程数据
		const courses = await feishuClient.importMetadatasToCourseInfoTable(courseMetadatas);

		// 如果选择了同步到日程
		if (shouldSync) {
			showMessage('正在同步到飞书日程...');
			await syncCoursesToCalendar(courses);
		}

		renderCourseTable(courses);
		showMessage(`成功导入 ${courses.length} 门课程${shouldSync ? '并同步到日程' : ''}`);

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

		// 使用用户的openId过滤课程记录
		const recordsData = await feishuClient.getCourseInfoTableMetadata(userInfo?.openId);

		// 导入CourseRecord类和处理函数
		const { processFeishuRecords } = await import('./js/CourseRecord.js');

		// 使用批量处理函数
		const courses = processFeishuRecords(recordsData.items);

		renderCourseTable(courses);
		showMessage(`成功加载 ${courses.length} 门课程`);

	} catch (error) {
		console.error('加载课程失败:', error);
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
            <th class="${currentDay === 1 ? 'today-column' : ''}" ${currentDay === 1 ? 'style="width: 20%;"' : ''}>
              ${currentDay === 1 ? '📅 ' : ''}周一
            </th>
            <th class="${currentDay === 2 ? 'today-column' : ''}" ${currentDay === 2 ? 'style="width: 20%;"' : ''}>
              ${currentDay === 2 ? '📅 ' : ''}周二
            </th>
            <th class="${currentDay === 3 ? 'today-column' : ''}" ${currentDay === 3 ? 'style="width: 20%;"' : ''}>
              ${currentDay === 3 ? '📅 ' : ''}周三
            </th>
            <th class="${currentDay === 4 ? 'today-column' : ''}" ${currentDay === 4 ? 'style="width: 20%;"' : ''}>
              ${currentDay === 4 ? '📅 ' : ''}周四
            </th>
            <th class="${currentDay === 5 ? 'today-column' : ''}" ${currentDay === 5 ? 'style="width: 20%;"' : ''}>
              ${currentDay === 5 ? '📅 ' : ''}周五
            </th>
          </tr>
        </thead>
        <tbody>
  `;

	// 获取时间段信息
	const periodInfo = courseSchedule.getPeriodInfo();

	// 找出当前正在进行的课程和下一节课
	let currentCourse = null;
	let nextCourse = null;
	if (currentDay >= 1 && currentDay <= 5) {
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
		// 检查是否是当前时间段
		const isCurrentPeriod = currentDay >= 1 && currentDay <= 5 &&
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

				// 检查是否是正在上课或下一节课（只在今天的课程中高亮）
				const isCurrentClass = currentCourse && currentCourse === course && day === currentDay;
				const isNextClass = nextCourse && nextCourse === course && day === currentDay;

				rowHTML += `
          <td class="course-cell ${day === currentDay ? 'today-course' : ''} ${isCurrentClass ? 'current-course-highlight' : ''} ${isNextClass ? 'next-course-highlight' : ''}" 
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
				rowHTML += `<td class="empty-cell ${day === currentDay ? 'today-empty' : ''}"></td>`;
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
		await loadAndRenderCourses();
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
}

// 初始化导入对话框
function initImportDialog() {
	const dialog = document.getElementById('importDialog');
	const dropZone = document.getElementById('dropZone');
	const closeBtn = document.getElementById('closeImportDialog');
	const cancelBtn = document.getElementById('cancelImport');
	const confirmBtn = document.getElementById('confirmImport');

	// 关闭按钮事件
	closeBtn?.addEventListener('click', closeImportDialog);
	cancelBtn?.addEventListener('click', closeImportDialog);

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
		await handleFileImport(null, file, shouldSync);
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
async function syncCoursesToCalendar(courses) {
	// TODO: 实现课程同步到飞书日程的功能
	console.log('同步课程到日程的功能待实现');
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