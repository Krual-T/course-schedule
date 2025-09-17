import { courseSchedule } from './CourseSchedule.js';
import CourseTime from './CourseTime.js';
import { FeishuClient } from './FeishuClient.js';
/**
 * 飞书日历同步类
 * 负责将课程数据转换为飞书日历事件格式
 */
export class CalendarSync {
    /**
     * 将课程同步到飞书日历
     * @param {FeishuClient} feishuClient 全局实例
     */
    constructor(feishuClient) {
        this.feishuClient = feishuClient;
        this.courseTime = new CourseTime();
    }

    /**
     * 将课程同步到飞书日历
     * @param {Array} courses 课程列表
     * @param {string} reminderOption 提醒选项 ('none'/'5min'/'15min')
     * @param {Function} onProgress 进度回调函数
     * @returns {Promise<Object>} 同步结果
     */
    async syncCoursesToCalendar(courses, reminderOption = 'none', onProgress) {
        const result = {
            success: [],
            failed: [],
            skipped: [],  // 新增跳过的课程列表
            total: courses.length
        };

        try {
            // 1. 创建或获取课程表日历
            const calendarId = await this.getOrCreateCourseCalendar();
            
            // 2. 逐个同步课程
            for (let i = 0; i < courses.length; i++) {
                const course = courses[i];
                
                // 兜底检查：如果课程已有eventId，跳过创建
                if (course.eventId) {
                    console.log(`课程 "${course.courseName}" 已有日程(eventId: ${course.eventId})，跳过创建`);
                    result.skipped.push({
                        course: course.courseName,
                        eventId: course.eventId,
                        reason: '已存在日程'
                    });
                    
                    // 更新进度
                    if (onProgress) {
                        onProgress({
                            current: i + 1,
                            total: courses.length,
                            courseName: course.courseName,
                            status: 'skipped'
                        });
                    }
                    
                    continue;  // 跳过此课程，继续下一个
                }
                
                try {
                    // 更新进度
                    if (onProgress) {
                        onProgress({
                            current: i + 1,
                            total: courses.length,
                            courseName: course.courseName,
                            status: 'processing'
                        });
                    }
                    
                    // 创建日程事件
                    const event = await this.createCourseEvent(calendarId, course, reminderOption);
                    
                    // 飞书API返回的是 {event: {event_id: "xxx", ...}}
                    const eventId = event?.event?.event_id || event?.event_id || 'unknown';
                    
                    result.success.push({
                        course: course.courseName,
                        eventId: eventId
                    });
                    
                } catch (error) {
                    console.error(`同步课程 "${course.courseName}" 失败:`, error);
                    result.failed.push({
                        course: course.courseName,
                        error: error.message
                    });
                }
                
                // 添加短暂延迟，避免触发API限流
                await this.delay(15);
            }
            
            // 输出同步结果统计
            console.log('同步结果:', {
                成功: result.success.length,
                失败: result.failed.length,
                跳过: result.skipped.length,
                总计: result.total
            });
            
            return result;
            
        } catch (error) {
            console.error('同步过程出错:', error);
            throw new Error(`日历同步失败: ${error.message}`);
        }
    }

    /**
     * 创建或获取课程表日历
     * @returns {Promise<string>} 日历ID
     */
    async getOrCreateCourseCalendar() {
        // 先检查本地存储是否有日历ID
        const storedCalendarId = localStorage.getItem('course_calendar_id');
        if (storedCalendarId) {
            console.log('使用已存储的课程表日历ID:', storedCalendarId);
            return storedCalendarId;
        }
        
        try {
            // 先尝试获取现有日历列表，查找是否已有课程表日历
            const listResponse = await this.feishuClient.get('/calendar/v4/calendars');
            if (listResponse.calendar_list && listResponse.calendar_list.length > 0) {
                // 查找名为"课程表"的日历
                const courseCalendar = listResponse.calendar_list.find(
                    cal => cal.summary === '课程表' || cal.summary_alias === 'Course Schedule'
                );
                
                if (courseCalendar) {
                    console.log('找到已存在的课程表日历:', courseCalendar.calendar_id);
                    localStorage.setItem('course_calendar_id', courseCalendar.calendar_id);
                    return courseCalendar.calendar_id;
                }
            }
            
            // 如果没有找到，创建一个新的课程表日历
            const calendarData = {
                summary: "课程表",
                description: "课程安排日历 - 由课程表应用自动创建",
                permissions: "private",
                color: 4,  // 使用蓝色
                summary_alias: "Course Schedule"
            };
            
            console.log('准备创建日历，请求数据:', calendarData);
            const response = await this.feishuClient.post('/calendar/v4/calendars', calendarData);
            console.log('创建日历响应:', response);
            
            // 飞书API返回格式: response直接就是data内容（因为FeishuClient已经处理了）
            if (response && response.calendar && response.calendar.calendar_id) {
                console.log('成功创建课程表日历:', response.calendar.calendar_id);
                localStorage.setItem('course_calendar_id', response.calendar.calendar_id);
                return response.calendar.calendar_id;
            }
            
            throw new Error('创建日历失败，未返回日历ID');
            
        } catch (error) {
            console.error('创建或获取课程表日历失败:', error);
            
            // 最后的回退方案：使用第一个可用日历
            try {
                const listResponse = await this.feishuClient.get('/calendar/v4/calendars');
                if (listResponse.calendar_list && listResponse.calendar_list.length > 0) {
                    const calendarId = listResponse.calendar_list[0].calendar_id;
                    console.warn('使用默认日历:', calendarId);
                    localStorage.setItem('course_calendar_id', calendarId);
                    return calendarId;
                }
            } catch (listError) {
                console.error('获取日历列表也失败:', listError);
            }
            
            throw new Error(`获取或创建日历失败: ${error.message}`);
        }
    }

    /**
     * 创建单个课程的日程事件
     * @param {string} calendarId 日历ID
     * @param {Object} course 课程对象
     * @param {string} reminderOption 提醒选项
     * @returns {Promise<Object>} 创建的事件对象
     */
    async createCourseEvent(calendarId, course, reminderOption) {
        // 计算课程的首次开始时间
        const { startTime, endTime } = this.calculateCourseTime(course);
        
        // 构建地点对象
        const locationData = {
            name: course.location || ''
        };
        
        // 如果有经纬度信息，添加到地点对象
        if (course.latitudeAndLongitude) {
            const [longitude, latitude] = course.latitudeAndLongitude.split(',').map(v => v.trim());
            if (longitude && latitude) {
                locationData.longitude = parseFloat(longitude);
                locationData.latitude = parseFloat(latitude);
            }
        }
        
        // 构建事件数据
        const eventData = {
            summary: course.courseName,
            description: this.generateDescription(course),
            location: locationData,
            start_time: {
                timestamp: String(Math.floor(startTime.getTime() / 1000)),
                timezone: 'Asia/Shanghai'
            },
            end_time: {
                timestamp: String(Math.floor(endTime.getTime() / 1000)),
                timezone: 'Asia/Shanghai'
            },
            vchat: {
                vtype: 'no_meeting'
            },
            visibility: 'private',
            free_busy_status: 'busy'
        };

        // 添加重复规则
        const recurrence = this.generateRecurrenceRule(course);
        if (recurrence) {
            eventData.recurrence = recurrence;
        }

        // 添加提醒设置
        const reminders = this.getReminderSettings(reminderOption);
        if (reminders && reminders.length > 0) {
            eventData.reminders = reminders;
        }

        console.log(`创建日程事件 - 课程: ${course.courseName}, 日历ID: ${calendarId}`);
        console.log('事件数据:', eventData);

        // 调用飞书API创建事件 - 使用正确的路径格式
        const response = await this.feishuClient.post(
            `/calendar/v4/calendars/${calendarId}/events`,
            eventData
        );
        
        console.log('创建日程响应:', response);
        
        // 如果创建成功，更新课程记录的event_id字段
        if (response?.event?.event_id && course.recordId) {
            await this.updateCourseEventId(course.recordId, response.event.event_id);
        }
        
        return response;
    }
    
    /**
     * 更新课程记录的event_id字段
     * @param {string} recordId 记录ID
     * @param {string} eventId 事件ID
     */
    async updateCourseEventId(recordId, eventId) {
        try {
            // 获取配置
            const config = await this.getConfig();
            const appToken = config.VITE_FEISHU_DATABASE_ID;
            
            // 获取表信息
            const tableInfo = await this.feishuClient._getTableInfo('course_information');
            
            // 更新记录
            const updateData = {
                fields: {
                    event_id: eventId
                }
            };
            
            const response = await this.feishuClient.put(
                `/bitable/v1/apps/${appToken}/tables/${tableInfo.table_id}/records/${recordId}`,
                updateData
            );
            
            console.log(`已更新课程记录 ${recordId} 的event_id为 ${eventId}`);
            return response;
        } catch (error) {
            console.error(`更新event_id失败:`, error);
            // 不抛出错误，避免影响主流程
        }
    }
    
    /**
     * 获取配置
     */
    async getConfig() {
        try {
            // 尝试从 API 获取配置
            const response = await fetch('/api/config');
            const config = await response.json();
            if (config && config.VITE_FEISHU_DATABASE_ID) {
                return config;
            }
        } catch (error) {
            console.log('从API获取配置失败，尝试其他方式');
        }
        
        // 如果 API 获取失败，尝试从 localStorage 获取
        const storedConfig = localStorage.getItem('feishu_config');
        if (storedConfig) {
            try {
                return JSON.parse(storedConfig);
            } catch (e) {
                console.log('解析存储的配置失败');
            }
        }
        
        // 返回默认配置
        return {
            VITE_FEISHU_DATABASE_ID: '',
            VITE_FEISHU_APP_ID: '',
            VITE_FEISHU_REDIRECT_URI: 'http://localhost:8787'
        };
    }

    /**
     * 计算课程的开始和结束时间
     * @param {Object} course 课程对象
     * @returns {Object} 包含startTime和endTime的对象
     */
    calculateCourseTime(course) {
        // 获取学期开始日期
        const semesterStart = new Date(courseSchedule.semesterStartDate);
        
        // 计算第一周的周一
        const firstMonday = new Date(semesterStart);
        const dayOfWeek = firstMonday.getDay();
        if (dayOfWeek !== 1) {
            // 如果不是周一，调整到下一个周一
            const daysToAdd = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
            firstMonday.setDate(firstMonday.getDate() + daysToAdd);
        }
        
        // 计算课程开始周的日期
        const courseWeekStart = new Date(firstMonday);
        courseWeekStart.setDate(firstMonday.getDate() + (course.startWeek - 1) * 7);
        
        // 计算课程具体的日期（加上星期几的偏移）
        const courseDate = new Date(courseWeekStart);
        courseDate.setDate(courseWeekStart.getDate() + (course.dayOfWeek - 1));
        
        // 使用 CourseTime 获取准确的时间信息
        const startPeriodInfo = this.courseTime.getPeriodInfo(course.startPeriod);
        const endPeriodInfo = this.courseTime.getPeriodInfo(course.endPeriod);
        
        if (!startPeriodInfo || !endPeriodInfo) {
            throw new Error(`无效的节次信息: 第${course.startPeriod}-${course.endPeriod}节`);
        }
        
        // 设置开始时间 - 使用第一节的开始时间
        const startTime = new Date(courseDate);
        // startPeriodInfo.time 格式: "08:00-08:45"
        const [startTimeStr] = startPeriodInfo.time.split('-');
        const [startHour, startMinute] = startTimeStr.split(':').map(Number);
        startTime.setHours(startHour, startMinute, 0, 0);
        
        // 设置结束时间 - 使用最后一节的结束时间
        const endTime = new Date(courseDate);
        // endPeriodInfo.time 格式: "10:40-11:25" 
        const [, endTimeStr] = endPeriodInfo.time.split('-');
        const [endHour, endMinute] = endTimeStr.split(':').map(Number);
        endTime.setHours(endHour, endMinute, 0, 0);
        
        console.log(`课程时间计算 - ${course.courseName}:`, {
            节次: `第${course.startPeriod}-${course.endPeriod}节`,
            开始时间: startTime.toLocaleString('zh-CN'),
            结束时间: endTime.toLocaleString('zh-CN')
        });
        
        return { startTime, endTime };
    }

    /**
     * 生成课程描述
     * @param {Object} course 课程对象
     * @returns {string} 描述文本
     */
    generateDescription(course) {
        const lines = [];
        
        if (course.teacher) {
            lines.push(`教师: ${course.teacher}`);
        }
        
        if (course.location) {
            lines.push(`地点: ${course.location}`);
        }
        
        if (course.courseCode) {
            lines.push(`课程代码: ${course.courseCode}`);
        }
        
        lines.push(`周次: 第${course.startWeek}-${course.endWeek}周`);
        lines.push(`节次: 第${course.startPeriod}-${course.endPeriod}节`);
        
        if (course.weekType === 'odd') {
            lines.push('类型: 单周');
        } else if (course.weekType === 'even') {
            lines.push('类型: 双周');
        }
        
        if (course.notes) {
            lines.push(`备注: ${course.notes}`);
        }
        
        return lines.join('\n');
    }

    /**
     * 生成重复规则
     * @param {Object} course 课程对象
     * @returns {Object|null} 重复规则对象
     */
    generateRecurrenceRule(course) {
        // 计算重复次数
        let count = course.endWeek - course.startWeek + 1;
        
        // 如果是单双周，次数要减半
        if (course.weekType === 'odd' || course.weekType === 'even') {
            count = Math.ceil(count / 2);
        }
        
        // 只有多于1次的课程才需要重复规则
        if (count <= 1) {
            return null;
        }
        
        // 构建RRULE
        const weekDayMap = {
            1: 'MO',
            2: 'TU',
            3: 'WE',
            4: 'TH',
            5: 'FR'
        };
        
        let rrule = `FREQ=WEEKLY;BYDAY=${weekDayMap[course.dayOfWeek]}`;
        
        // 单双周设置间隔
        if (course.weekType === 'odd' || course.weekType === 'even') {
            rrule += ';INTERVAL=2';
        } else {
            rrule += ';INTERVAL=1';
        }
        
        rrule += `;COUNT=${count}`;
        
        return rrule;
    }

    /**
     * 获取提醒设置
     * @param {string} option 提醒选项
     * @returns {Array} 提醒设置数组
     */
    getReminderSettings(option) {
        switch(option) {
            case '5min':
                return [{ minutes: 5 }];
            case '15min':
                return [{ minutes: 15 }];
            case '30min':
                return [{ minutes: 30 }];
            case 'none':
            default:
                return [];
        }
    }

    /**
     * 删除单个课程的日程事件
     * @param {string} eventId 事件ID
     * @param {string} recordId 记录ID（可选，用于清除记录中的event_id）
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteCourseEvent(eventId, recordId = null) {
        try {
            // 获取或创建日历ID
            const calendarId = localStorage.getItem('course_calendar_id');
            if (!calendarId) {
                throw new Error('未找到课程日历');
            }
            
            // 调用飞书API删除事件
            await this.feishuClient.delete(
                `/calendar/v4/calendars/${calendarId}/events/${eventId}`
            );
            
            console.log(`已删除日程事件: ${eventId}`);
            
            // 如果提供了recordId，清除记录中的event_id
            if (recordId) {
                await this.clearCourseEventId(recordId);
            }
            
            return true;
        } catch (error) {
            console.error(`删除日程事件失败:`, error);
            throw new Error(`删除日程失败: ${error.message}`);
        }
    }
    
    /**
     * 清除课程记录的event_id字段
     * @param {string} recordId 记录ID
     */
    async clearCourseEventId(recordId) {
        try {
            // 获取配置
            const config = await this.getConfig();
            const appToken = config.VITE_FEISHU_DATABASE_ID;
            
            // 获取表信息
            const tableInfo = await this.feishuClient._getTableInfo('course_information');
            
            // 更新记录，清空event_id
            const updateData = {
                fields: {
                    event_id: ''
                }
            };
            
            const response = await this.feishuClient.put(
                `/bitable/v1/apps/${appToken}/tables/${tableInfo.table_id}/records/${recordId}`,
                updateData
            );
            
            console.log(`已清除课程记录 ${recordId} 的event_id`);
            return response;
        } catch (error) {
            console.error(`清除event_id失败:`, error);
            // 不抛出错误，避免影响主流程
        }
    }
    
    /**
     * 创建或删除单个课程的日程（切换功能）
     * @param {Object} course 课程对象
     * @param {string} reminderOption 提醒选项
     * @returns {Promise<Object>} 操作结果
     */
    async toggleCourseEvent(course, reminderOption = 'none') {
        if (course.eventId) {
            // 如果已有日程，删除它
            await this.deleteCourseEvent(course.eventId, course.recordId);
            return { action: 'deleted', eventId: null };
        } else {
            // 如果没有日程，创建它
            const calendarId = await this.getOrCreateCourseCalendar();
            const event = await this.createCourseEvent(calendarId, course, reminderOption);
            return { action: 'created', eventId: event?.event?.event_id || event?.event_id };
        }
    }
    
    /**
     * 延迟函数
     * @param {number} ms 延迟毫秒数
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 批量清空所有课程的event_id字段
     * @returns {Promise<Object>} 清空结果
     */
    async clearAllCourseEventIds() {
        try {
            // 获取所有有event_id的课程记录
            const recordsData = await this.feishuClient.getAllUserCourses();
            const coursesWithEventId = recordsData.items.filter(item => 
                item.fields && item.fields.event_id && item.fields.event_id.length > 0
            );
            
            const result = {
                total: coursesWithEventId.length,
                success: 0,
                failed: 0
            };
            
            console.log(`开始清空 ${result.total} 条课程的event_id`);
            
            // 批量清空
            for (const record of coursesWithEventId) {
                try {
                    await this.clearCourseEventId(record.record_id);
                    result.success++;
                    // 短暂延迟避免API限流
                    await this.delay(30);
                } catch (error) {
                    console.error(`清空记录 ${record.record_id} 的event_id失败:`, error);
                    result.failed++;
                }
            }
            
            console.log(`清空完成: 成功 ${result.success}/${result.total}`);
            return result;
            
        } catch (error) {
            console.error('批量清空event_id失败:', error);
            throw new Error(`批量清空失败: ${error.message}`);
        }
    }

    /**
     * 检查并删除重复的日程
     * @param {string} calendarId 日历ID
     * @param {Object} course 课程对象
     * @returns {Promise<Array>} 删除的事件ID列表
     */
    async checkAndRemoveDuplicates(calendarId, course) {
        try {
            // 获取日历中的事件列表
            const events = await this.getCalendarEvents(calendarId);
            
            // 查找同名课程
            const duplicates = events.filter(event => 
                event.summary === course.courseName &&
                event.location === course.location
            );
            
            // 删除重复的事件
            const deletedIds = [];
            for (const duplicate of duplicates) {
                try {
                    await this.feishuClient.delete(
                        `/calendar/v4/calendars/${calendarId}/events/${duplicate.event_id}`
                    );
                    deletedIds.push(duplicate.event_id);
                } catch (error) {
                    console.error(`删除重复事件失败: ${error.message}`);
                }
            }
            
            return deletedIds;
            
        } catch (error) {
            console.error('检查重复事件失败:', error);
            return [];
        }
    }

    /**
     * 获取日历事件列表
     * @param {string} calendarId 日历ID
     * @returns {Promise<Array>} 事件列表
     */
    async getCalendarEvents(calendarId) {
        try {
            // 计算查询时间范围（当前学期）
            const semesterStart = new Date(courseSchedule.semesterStartDate);
            const semesterEnd = new Date(semesterStart);
            semesterEnd.setDate(semesterEnd.getDate() + 20 * 7); // 20周
            
            const response = await this.feishuClient.get(
                `/calendar/v4/calendars/${calendarId}/events`,
                {
                    start_time: String(Math.floor(semesterStart.getTime() / 1000)),
                    end_time: String(Math.floor(semesterEnd.getTime() / 1000)),
                    page_size: 500
                }
            );
            
            return response.items || [];
            
        } catch (error) {
            console.error('获取日历事件失败:', error);
            return [];
        }
    }
}

export default CalendarSync;