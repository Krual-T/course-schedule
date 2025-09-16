import { courseSchedule } from './CourseSchedule.js';
import CourseTime from './CourseTime.js';

/**
 * 飞书日历同步类
 * 负责将课程数据转换为飞书日历事件格式
 */
export class CalendarSync {
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
            total: courses.length
        };

        try {
            // 1. 获取用户主日历ID
            const calendarId = await this.getPrimaryCalendarId();
            
            // 2. 逐个同步课程
            for (let i = 0; i < courses.length; i++) {
                const course = courses[i];
                
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
                    result.success.push({
                        course: course.courseName,
                        eventId: event.event_id
                    });
                    
                } catch (error) {
                    console.error(`同步课程 "${course.courseName}" 失败:`, error);
                    result.failed.push({
                        course: course.courseName,
                        error: error.message
                    });
                }
                
                // 添加短暂延迟，避免触发API限流
                await this.delay(200);
            }
            
            return result;
            
        } catch (error) {
            console.error('同步过程出错:', error);
            throw new Error(`日历同步失败: ${error.message}`);
        }
    }

    /**
     * 获取用户主日历ID
     * @returns {Promise<string>} 日历ID
     */
    async getPrimaryCalendarId() {
        try {
            const response = await this.feishuClient.get('/calendar/v4/calendars/primary');
            return response.calendar.calendar_id;
        } catch (error) {
            throw new Error(`获取主日历失败: ${error.message}`);
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
        
        // 构建事件数据
        const eventData = {
            summary: course.courseName,
            description: this.generateDescription(course),
            location: course.location || '',
            start_time: {
                timestamp: String(Math.floor(startTime.getTime() / 1000)),
                timezone: 'Asia/Shanghai'
            },
            end_time: {
                timestamp: String(Math.floor(endTime.getTime() / 1000)),
                timezone: 'Asia/Shanghai'
            },
            visibility: 'default',
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

        // 调用飞书API创建事件
        return await this.feishuClient.post(
            `/calendar/v4/calendars/${calendarId}/events`,
            eventData
        );
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
        
        // 获取课程开始和结束时间
        const startPeriodInfo = this.courseTime.getPeriodInfo(course.startPeriod);
        const endPeriodInfo = this.courseTime.getPeriodInfo(course.endPeriod);
        
        // 设置具体时间
        const startTime = new Date(courseDate);
        const [startHour, startMinute] = startPeriodInfo.time.split('-')[0].split(':').map(Number);
        startTime.setHours(startHour, startMinute, 0, 0);
        
        const endTime = new Date(courseDate);
        const [endHour, endMinute] = endPeriodInfo.time.split('-')[1].split(':').map(Number);
        endTime.setHours(endHour, endMinute, 0, 0);
        
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
     * 延迟函数
     * @param {number} ms 延迟毫秒数
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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