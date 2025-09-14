import CourseTime from './CourseTime.js';

class CourseSchedule {
    // 学期开始日期，格式：YYYY-MM-DD
    static SEMESTER_START_DATE = '2025-09-01';

    constructor() {
        this.courseTime = new CourseTime();
        this.currentDate = new Date();
    }

    // 计算当前是第几周
    getCurrentWeek() {
        const startDate = new Date(CourseSchedule.SEMESTER_START_DATE);
        const diff = this.currentDate - startDate;
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        return Math.floor(diff / oneWeek) + 1;
    }

    // 获取当前周的课程
    filterCoursesByCurrentWeek(courses) {
        const currentWeek = this.getCurrentWeek();
        return courses.filter(course =>
            currentWeek >= course.startWeek &&
            currentWeek <= course.endWeek
        );
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
}

// 创建全局实例
export const courseSchedule = new CourseSchedule();

export default CourseSchedule;
