import CourseTime from './CourseTime.js';

class CourseSchedule {
    // 学期开始日期配置
    static FIRST_SEMESTER_START = '2025-09-01';  // 第一学期：2025年9月1日
    static SECOND_SEMESTER_START = '2026-03-02'; // 第二学期：2026年3月2日

    constructor() {
        this.courseTime = new CourseTime();
        this.currentDate = new Date();
        // 根据当前月份判断使用哪个学期的开始日期
        this.semesterStartDate = this.getCurrentSemesterStartDate();
    }

    // 根据当前月份获取对应学期的开始日期
    getCurrentSemesterStartDate() {
        const month = this.currentDate.getMonth() + 1; // getMonth() 返回 0-11
        
        // 3月-7月为第二学期
        if (month >= 3 && month <= 7) {
            return CourseSchedule.SECOND_SEMESTER_START;
        } 
        // 8月-次年2月为第一学期
        else {
            return CourseSchedule.FIRST_SEMESTER_START;
        }
    }

    // 计算当前是第几周
    getCurrentWeek() {
        // 使用UTC时间计算，避免时区问题
        // 北京时间 = UTC + 8小时
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const beijingTime = new Date(utcTime + (8 * 3600000));
        
        // 解析学期开始日期
        const [year, month, day] = this.semesterStartDate.split('-').map(Number);
        // 创建学期开始日期（北京时间00:00:00）
        const startDate = new Date(Date.UTC(year, month - 1, day) - (8 * 3600000));
        
        // 获取北京时间的日期部分（00:00:00）
        const beijingDateOnly = new Date(
            beijingTime.getFullYear(),
            beijingTime.getMonth(),
            beijingTime.getDate()
        );
        
        // 获取学期开始日期的日期部分（00:00:00）
        const startDateOnly = new Date(year, month - 1, day);
        
        
        // 计算相差的天数
        const diffTime = beijingDateOnly.getTime() - startDateOnly.getTime();
        const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
        
        // 计算周数：
        // 第0-6天是第1周，第7-13天是第2周，第14-20天是第3周
        const weekNumber = Math.floor(diffDays / 7) + 1;
        
        // 确保周数在合理范围内
        const finalWeek = Math.max(1, Math.min(weekNumber, this.getTotalWeeks()));
        
        return finalWeek;
    }

    // 获取指定周的课程
    filterCoursesByWeek(courses, weekNumber) {
        return courses.filter(course => {
            // 检查课程是否在该周有效
            if (weekNumber < course.startWeek || weekNumber > course.endWeek) {
                return false;
            }
            
            // 检查单双周
            if (course.weekType === 'odd' && weekNumber % 2 === 0) {
                return false;
            }
            if (course.weekType === 'even' && weekNumber % 2 === 1) {
                return false;
            }
            
            return true;
        });
    }
    
    // 获取当前周的课程
    filterCoursesByCurrentWeek(courses) {
        const currentWeek = this.getCurrentWeek();
        return this.filterCoursesByWeek(courses, currentWeek);
    }

    // 获取当前时间所在的课程时间段
    getCurrentPeriodInfo() {
        const now = this.currentDate;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // 获取所有时间段
        const periods = this.courseTime.getAllPeriods();

        // 查找当前时间所在的时间段
        return periods.find(period =>
            currentMinutes >= period.startMinutes &&
            currentMinutes <= period.endMinutes
        );
    }

    // 获取所有时间段信息
    getPeriodInfo() {
        return this.courseTime.getAllPeriods();
    }

    // 判断是否为工作日（周一至周五）
    isWorkday() {
        const day = this.currentDate.getDay();
        return day >= 1 && day <= 5;
    }

    // 获取今天是周几（1-7）
    getCurrentDay() {
        const day = this.currentDate.getDay();
        return day === 0 ? 7 : day;
    }

    // 设置当前日期（用于测试）
    setCurrentDate(date) {
        this.currentDate = new Date(date);
    }
    
    // 获取学期总周数
    getTotalWeeks() {
        return 20; // 一般大学一学期20周
    }
    
    // 获取指定周的日期范围
    getWeekDateRange(weekNumber) {
        const startDate = new Date(this.semesterStartDate);
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (weekNumber - 1) * 7);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        return {
            start: weekStart,
            end: weekEnd
        };
    }
    
    // 检查周数是否有效
    isValidWeek(weekNumber) {
        return weekNumber >= 1 && weekNumber <= this.getTotalWeeks();
    }
}

// 创建全局实例
export const courseSchedule = new CourseSchedule();

export default CourseSchedule;
