// 课程时间管理类
class CourseTime {
    // 定义一节课的持续时间（分钟）
    static COURSE_DURATION = 45;

    // 定义上午、下午、晚上的时间段起始时间
    static MORNING_START = '08:00';
    static AFTERNOON_START = '14:00';
    static EVENING_START = '18:30';

    constructor() {
        this.periodStartTimes = {
            // 上午时段
            1: '08:00',
            2: '08:50',
            3: '09:50',
            4: '10:40',
            5: '11:25',
            // 下午时段
            6: '14:00',
            7: '14:50',
            8: '15:50',
            9: '16:40',
            // 晚上时段
            10: '18:30',
            11: '19:20',
            12: '20:10',
            13: '21:45'
        };
    }

    // 根据节次获取对应的时间段信息
    getPeriodInfo(period) {
        const startTime = this.periodStartTimes[period];
        if (!startTime) return null;

        const [hours, minutes] = startTime.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + CourseTime.COURSE_DURATION;

        return {
            period,
            time: `${startTime}-${this.minutesToTimeString(endMinutes)}`,
            startMinutes,
            endMinutes,
            section: this.getTimeSection(startTime)
        };
    }

    // 获取所有时间段信息
    getAllPeriods() {
        return Object.keys(this.periodStartTimes).map(period =>
            this.getPeriodInfo(Number(period))
        );
    }

    // 将分钟数转换为时间字符串
    minutesToTimeString(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // 判断时间段属于哪个部分（上午/下午/晚上）
    getTimeSection(timeString) {
        const time = this.timeStringToMinutes(timeString);
        if (time < this.timeStringToMinutes(CourseTime.AFTERNOON_START)) {
            return '上午';
        } else if (time < this.timeStringToMinutes(CourseTime.EVENING_START)) {
            return '下午';
        } else {
            return '晚上';
        }
    }

    // 将时间字符串转换为分钟数
    timeStringToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }
}

export default CourseTime;
