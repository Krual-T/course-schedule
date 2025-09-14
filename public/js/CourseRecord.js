/**
 * 课程记录类
 * 用于存储单条课程记录并映射飞书API数据
 */
export class CourseRecord {
    constructor(data = {}) {
        // 基础字段 - 课程表必需
        this.recordId = data.recordId || '';  // 使用飞书的record_id作为唯一标识
        this.courseName = data.courseName || '';
        this.location = data.location || '';
        this.teacher = data.teacher || '';
        this.studentName = data.studentName || '';  // 学生姓名（从student_info的en_name获取）
        this.dayOfWeek = data.dayOfWeek || 1;      // 1-5 表示周一到周五
        this.startPeriod = data.startPeriod || 1;   // 起始节次 1-13
        this.endPeriod = data.endPeriod || 1;       // 结束节次 1-13
        this.startWeek = data.startWeek || 1;       // 起始周
        this.endWeek = data.endWeek || 16;          // 结束周
        
        // 扩展字段 - 可根据需要添加更多字段
        this.courseCode = data.courseCode || '';
        this.credits = data.credits || 0;
        this.courseType = data.courseType || '';
        this.weekType = data.weekType || 'all';     // all/odd/even 全部/单周/双周
        this.department = data.department || '';
        this.classroom = data.classroom || '';
        this.studentCount = data.studentCount || 0;
        this.notes = data.notes || '';
        this.color = data.color || this.generateColor();
        
        // 时间戳
        this.lastSyncTime = data.lastSyncTime || null;
        
        // 时间戳
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }
    
    
    /**
     * 生成随机颜色
     */
    generateColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#FFB6C1', '#87CEEB', '#F0E68C'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    /**
     * 从飞书API记录创建CourseRecord实例
     * @param {Object} record 飞书API返回的记录对象
     * @returns {CourseRecord} CourseRecord实例
     */
    static fromFeishuRecord(record) {
        const fields = record.fields || {};
        
        // 处理文本类型字段
        const getText = (field) => {
            if (!field) return '';
            if (Array.isArray(field) && field[0]) {
                return field[0].text || '';
            }
            return '';
        };
        
        // 处理人员类型字段（只取en_name）
        const getPersonName = (field) => {
            if (!field) return '';
            if (Array.isArray(field) && field[0]) {
                return field[0].en_name || '';
            }
            return '';
        };
        
        const getNumber = (field, defaultValue = 0) => {
            const value = parseInt(field);
            return isNaN(value) ? defaultValue : value;
        };
        
        return new CourseRecord({
            recordId: record.record_id,
            studentName: getPersonName(fields.student_info),  // 从student_info字段获取en_name
            courseName: getText(fields.course_name),
            courseCode: getText(fields.course_code),
            teacher: getText(fields.teacher),
            location: getText(fields.location),
            // classroom: getText(fields.classroom),
            dayOfWeek: getNumber(fields.day_of_week, 1),
            startPeriod: getNumber(fields.start_period, 1),
            endPeriod: getNumber(fields.end_period, 1),
            startWeek: getNumber(fields.start_week, 1),
            endWeek: getNumber(fields.end_week, 16),
            // weekType: fields.week_type || 'all',
            // courseType: fields.course_type || '',
            // credits: parseFloat(fields.credits) || 0,
            // department: getText(fields.department),
            // studentCount: getNumber(fields.student_count, 0),
            // notes: getText(fields.notes),
            // color: fields.color || undefined,
            // lastSyncTime: new Date().toISOString()
        });
    }
    
    /**
     * 转换为JSON格式
     */
    toJSON() {
        return {
            recordId: this.recordId,
            studentName: this.studentName,
            courseName: this.courseName,
            courseCode: this.courseCode,
            teacher: this.teacher,
            location: this.location,
            // classroom: this.classroom,
            dayOfWeek: this.dayOfWeek,
            startPeriod: this.startPeriod,
            endPeriod: this.endPeriod,
            startWeek: this.startWeek,
            endWeek: this.endWeek,
            // weekType: this.weekType,
            // courseType: this.courseType,
            // credits: this.credits,
            // department: this.department,
            // studentCount: this.studentCount,
            // notes: this.notes,
            // color: this.color,
            // lastSyncTime: this.lastSyncTime,
            // createdAt: this.createdAt,
            // updatedAt: this.updatedAt
        };
    }
    
    /**
     * 获取课程时间描述
     */
    getTimeDescription() {
        const days = ['', '周一', '周二', '周三', '周四', '周五'];
        const weekTypeText = {
            'all': '',
            'odd': '(单周)',
            'even': '(双周)'
        };
        
        return `${days[this.dayOfWeek]} 第${this.startPeriod}-${this.endPeriod}节 ${this.startWeek}-${this.endWeek}周${weekTypeText[this.weekType]}`;
    }
    
    /**
     * 验证数据是否有效
     */
    isValid() {
        return !!(
            this.courseName &&
            this.dayOfWeek >= 1 && this.dayOfWeek <= 5 &&
            this.startPeriod >= 1 && this.startPeriod <= 13 &&
            this.endPeriod >= 1 && this.endPeriod <= 13 &&
            this.startPeriod <= this.endPeriod &&
            this.startWeek <= this.endWeek
        );
    }
    
    /**
     * 获取课程持续节数
     */
    getDuration() {
        return this.endPeriod - this.startPeriod + 1;
    }
    
    /**
     * 检查指定周是否有课
     */
    hasClassInWeek(weekNumber) {
        if (weekNumber < this.startWeek || weekNumber > this.endWeek) {
            return false;
        }
        
        if (this.weekType === 'all') return true;
        if (this.weekType === 'odd' && weekNumber % 2 === 1) return true;
        if (this.weekType === 'even' && weekNumber % 2 === 0) return true;
        
        return false;
    }
}

/**
 * 批量处理飞书记录
 */
export function processFeishuRecords(records) {
    return records.map(record => CourseRecord.fromFeishuRecord(record));
}

/**
 * 按星期分组课程
 */
export function groupCoursesByDay(courses) {
    const grouped = {
        1: [], // 周一
        2: [], // 周二
        3: [], // 周三
        4: [], // 周四
        5: []  // 周五
    };
    
    courses.forEach(course => {
        if (course.dayOfWeek >= 1 && course.dayOfWeek <= 5) {
            grouped[course.dayOfWeek].push(course);
        }
    });
    
    // 对每天的课程按起始节次排序
    Object.keys(grouped).forEach(day => {
        grouped[day].sort((a, b) => a.startPeriod - b.startPeriod);
    });
    
    return grouped;
}