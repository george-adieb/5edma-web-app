// Mock data for the Sunday School Management App
// سجل الخدمة - مدارس الأحد

export const currentUser = {
  id: 1,
  name: 'أ. مينا كمال',
  role: 'خادم',
  church: 'كنيسة الشهيد العظيم مارجرجس سيدي بشر',
  avatar: 'م ك',
  avatarColor: '#8B1A1A',
};

export const classes = [
  { id: 'all', label: 'الكل' },
  { id: 'grade1', label: 'الأول الابتدائي' },
  { id: 'grade2', label: 'الثاني الابتدائي' },
  { id: 'grade3', label: 'الثالث الابتدائي' },
  { id: 'grade4', label: 'الرابع الابتدائي' },
  { id: 'grade5', label: 'الخامس الابتدائي' },
  { id: 'grade6', label: 'السادس الابتدائي' },
];

/**
 * Centralized stage → year configuration.
 * Each stage contains an ordered list of years with:
 *   id:    the grade_id / gradeId value stored on student records
 *   label: the Arabic display name for the year option
 *
 * Stages with no years (e.g. خريجين) have an empty years array —
 * the UI will hide the year dropdown for those stages.
 */
export const STAGE_YEAR_CONFIG = [
  {
    id: 'حضانة',
    label: 'حضانة',
    years: [
      { id: 'kg1', label: 'أولى' },
      { id: 'kg2', label: 'تانية' },
    ],
  },
  {
    id: 'ابتدائي',
    label: 'ابتدائي',
    years: [
      { id: 'grade1', label: 'أولى' },
      { id: 'grade2', label: 'تانية' },
      { id: 'grade3', label: 'تالتة' },
      { id: 'grade4', label: 'رابعة' },
      { id: 'grade5', label: 'خامسة' },
      { id: 'grade6', label: 'سادسة' },
    ],
  },
  {
    id: 'إعدادي',
    label: 'إعدادي',
    years: [
      { id: 'grade7', label: 'أولى' },
      { id: 'grade8', label: 'تانية' },
      { id: 'grade9', label: 'تالتة' },
    ],
  },
  {
    id: 'ثانوي',
    label: 'ثانوي',
    years: [
      { id: 'grade10', label: 'أولى' },
      { id: 'grade11', label: 'تانية' },
      { id: 'grade12', label: 'تالتة' },
    ],
  },
  {
    id: 'جامعة',
    label: 'جامعة',
    years: [
      { id: 'uni1', label: 'أولى' },
      { id: 'uni2', label: 'تانية' },
      { id: 'uni3', label: 'تالتة' },
      { id: 'uni4', label: 'رابعة' },
      { id: 'uni5', label: 'خامسة' },
    ],
  },
  {
    id: 'خريجين',
    label: 'خريجين',
    years: [], // No year breakdown — stage filter is sufficient
  },
];

export const students = [
  {
    id: 1,
    name: 'بيشوي أنطونيوس',
    code: 'STD-4401',
    grade: 'الثالث الابتدائي',
    gradeId: 'grade3',
    gender: 'ذكر',
    parentPhone: '01234567890',
    parentName: 'أنطونيوس ميخائيل',
    birthDate: '15 مايو 2013',
    address: 'شارع فيصل، الجيزة',
    status: 'منتظم',
    lastAttendance: 'الأحد الماضي',
    attendanceRate: 92,
    bloodType: 'O+',
    medicalNotes: 'لا يوجد',
    hobbies: ['كرة القدم', 'الرسم'],
    avatar: 'ب أ',
    avatarColor: '#1D4ED8',
    attendanceHistory: [
      { date: '28 مارس 2026', status: 'حاضر' },
      { date: '21 مارس 2026', status: 'حاضر' },
      { date: '14 مارس 2026', status: 'غائب' },
      { date: '7 مارس 2026', status: 'حاضر' },
      { date: '28 فبراير 2026', status: 'حاضر' },
      { date: '21 فبراير 2026', status: 'معتذر' },
      { date: '14 فبراير 2026', status: 'حاضر' },
    ],
    followUpHistory: [
      { date: '14 مارس 2026', type: 'مكالمة', notes: 'تواصلنا مع الأهل، الطالب كان مريضاً', status: 'تم التواصل', servant: 'أ. مينا كمال' },
    ],
    notes: 'طالب متميز ومواظب. يشارك في أنشطة الكورال.',
  },
  {
    id: 2,
    name: 'كيرلس مرقس',
    code: 'STD-4415',
    grade: 'الرابع الابتدائي',
    gradeId: 'grade4',
    gender: 'ذكر',
    parentPhone: '01123456789',
    parentName: 'مرقس عبدالمسيح',
    birthDate: '3 أغسطس 2012',
    address: 'المنيل، القاهرة',
    status: 'يحتاج افتقاد',
    lastAttendance: 'منذ شهر',
    attendanceRate: 45,
    bloodType: 'A+',
    medicalNotes: 'لا يوجد',
    hobbies: ['كرة القدم'],
    avatar: 'ك م',
    avatarColor: '#7C3AED',
    attendanceHistory: [
      { date: '28 مارس 2026', status: 'غائب' },
      { date: '21 مارس 2026', status: 'غائب' },
      { date: '14 مارس 2026', status: 'غائب' },
      { date: '7 مارس 2026', status: 'غائب' },
      { date: '28 فبراير 2026', status: 'حاضر' },
      { date: '21 فبراير 2026', status: 'غائب' },
    ],
    followUpHistory: [
      { date: '21 مارس 2026', type: 'مكالمة', notes: 'لم يرد أحد على الهاتف', status: 'يحتاج متابعة', servant: 'أ. مينا كمال' },
    ],
    notes: 'يحتاج للمتابعة المستمرة، التواصل مع الأهل ضروري.',
  },
  {
    id: 3,
    name: 'مينا جرجس',
    code: 'STD-4388',
    grade: 'الثالث الابتدائي',
    gradeId: 'grade3',
    gender: 'ذكر',
    parentPhone: '01098765432',
    parentName: 'جرجس حبيب',
    birthDate: '22 يناير 2013',
    address: 'شبرا، القاهرة',
    status: 'منتظم',
    lastAttendance: 'الأحد الماضي',
    attendanceRate: 88,
    bloodType: 'B+',
    medicalNotes: 'لا يوجد',
    hobbies: ['القراءة', 'السباحة'],
    avatar: 'م ج',
    avatarColor: '#0D9488',
    attendanceHistory: [
      { date: '28 مارس 2026', status: 'حاضر' },
      { date: '21 مارس 2026', status: 'حاضر' },
      { date: '14 مارس 2026', status: 'معتذر' },
      { date: '7 مارس 2026', status: 'حاضر' },
      { date: '28 فبراير 2026', status: 'حاضر' },
    ],
    followUpHistory: [],
    notes: 'حضور منتظم. يتفاعل بشكل جيد مع الدروس.',
  },
  {
    id: 4,
    name: 'أبانوب رأفت',
    code: 'STD-4402',
    grade: 'الأول الابتدائي',
    gradeId: 'grade1',
    gender: 'ذكر',
    parentPhone: '01567891234',
    parentName: 'رأفت سمير',
    birthDate: '10 مارس 2015',
    address: 'الدقي، الجيزة',
    status: 'جديد',
    lastAttendance: 'الأحد الماضي',
    attendanceRate: 75,
    bloodType: '+0',
    medicalNotes: 'لا يوجد',
    hobbies: ['الرسم'],
    avatar: 'أ ر',
    avatarColor: '#EA580C',
    attendanceHistory: [
      { date: '28 مارس 2026', status: 'حاضر' },
      { date: '21 مارس 2026', status: 'غائب' },
      { date: '14 مارس 2026', status: 'حاضر' },
    ],
    followUpHistory: [],
    notes: 'طالب جديد. بدأ الحضور منذ شهر.',
  },
  {
    id: 5,
    name: 'مارينا كمال صبحي',
    code: 'STD-4390',
    grade: 'الثاني الابتدائي',
    gradeId: 'grade2',
    gender: 'أنثى',
    parentPhone: '01234509876',
    parentName: 'كمال صبحي',
    birthDate: '7 يوليو 2014',
    address: 'حلوان، القاهرة',
    status: 'يحتاج افتقاد',
    lastAttendance: 'الأسبوع الماضي',
    attendanceRate: 60,
    bloodType: 'AB+',
    medicalNotes: 'لا يوجد',
    hobbies: ['الموسيقى', 'الرسم'],
    avatar: 'م ص',
    avatarColor: '#DB2777',
    attendanceHistory: [
      { date: '28 مارس 2026', status: 'غائب' },
      { date: '21 مارس 2026', status: 'حاضر' },
      { date: '14 مارس 2026', status: 'غائب' },
      { date: '7 مارس 2026', status: 'غائب' },
    ],
    followUpHistory: [
      { date: '28 مارس 2026', type: 'رسالة', notes: 'تم إرسال رسالة واتساب للأهل', status: 'تم التواصل', servant: 'أ. مينا كمال' },
    ],
    notes: 'تحتاج لمتابعة أسبوعية.',
  },
  {
    id: 6,
    name: 'مينا تادرس فوزي',
    code: 'STD-4367',
    grade: 'الخامس الابتدائي',
    gradeId: 'grade5',
    gender: 'ذكر',
    parentPhone: '01011223344',
    parentName: 'تادرس فوزي',
    birthDate: '1 سبتمبر 2011',
    address: 'مدينة نصر، القاهرة',
    status: 'يحتاج افتقاد',
    lastAttendance: 'منذ أسبوعين',
    attendanceRate: 55,
    bloodType: 'A-',
    medicalNotes: 'لا يوجد',
    hobbies: ['كرة السلة'],
    avatar: 'م ت',
    avatarColor: '#16A34A',
    attendanceHistory: [
      { date: '28 مارس 2026', status: 'غائب' },
      { date: '21 مارس 2026', status: 'غائب' },
      { date: '14 مارس 2026', status: 'حاضر' },
      { date: '7 مارس 2026', status: 'غائب' },
    ],
    followUpHistory: [
      { date: '21 مارس 2026', type: 'زيارة', notes: 'زيارة منزلية مجدولة للأسبوع القادم', status: 'يحتاج متابعة', servant: 'أ. مينا كمال' },
    ],
    notes: 'يحتاج لتشجيع مستمر.',
  },
  {
    id: 7,
    name: 'ريتا سمير جورج',
    code: 'STD-4421',
    grade: 'الرابع الابتدائي',
    gradeId: 'grade4',
    gender: 'أنثى',
    parentPhone: '01055667788',
    parentName: 'سمير جورج',
    birthDate: '15 فبراير 2012',
    address: 'مصر الجديدة، القاهرة',
    status: 'منتظم',
    lastAttendance: 'الأحد الماضي',
    attendanceRate: 95,
    bloodType: 'O-',
    medicalNotes: 'لا يوجد',
    hobbies: ['الغناء', 'القراءة'],
    avatar: 'ر س',
    avatarColor: '#9333EA',
    attendanceHistory: [
      { date: '28 مارس 2026', status: 'حاضر' },
      { date: '21 مارس 2026', status: 'حاضر' },
      { date: '14 مارس 2026', status: 'حاضر' },
      { date: '7 مارس 2026', status: 'حاضر' },
      { date: '28 فبراير 2026', status: 'معتذر' },
    ],
    followUpHistory: [],
    notes: 'متميزة في الحضور والتفاعل.',
  },
  {
    id: 8,
    name: 'جوليا رأفت كمال',
    code: 'STD-4598',
    grade: 'الأول الابتدائي',
    gradeId: 'grade1',
    gender: 'أنثى',
    parentPhone: '01587654321',
    parentName: 'رأفت كمال',
    birthDate: '20 ديسمبر 2015',
    address: 'الزيتون، القاهرة',
    status: 'جديد',
    lastAttendance: 'لم تحضر بعد',
    attendanceRate: 0,
    bloodType: 'B-',
    medicalNotes: 'لا يوجد',
    hobbies: [],
    avatar: 'ج ر',
    avatarColor: '#DC2626',
    attendanceHistory: [],
    followUpHistory: [],
    notes: 'مسجلة حديثاً. لم تحضر بعد.',
  },
];

// Today's attendance state (mock)
export const todayAttendance = {
  date: '28 مارس 2026',
  dayName: 'الأحد',
  liturgy: 'قداس الصباح',
  records: {
    1: 'حاضر',
    2: 'غائب',
    3: 'معتذر',
    4: null,
    5: 'غائب',
    6: 'غائب',
    7: 'حاضر',
    8: null,
  },
};

// Follow-up list
export const followUps = [
  {
    id: 1,
    studentId: 2,
    studentName: 'كيرلس مرقس',
    avatar: 'ك م',
    avatarColor: '#7C3AED',
    grade: 'الرابع الابتدائي',
    absenceDuration: 'غائب منذ ٣ أسابيع',
    lastContact: 'لم يتم التواصل',
    status: 'عاجل',
    type: null,
    notes: '',
    urgency: 'urgent',
  },
  {
    id: 2,
    studentId: 5,
    studentName: 'مارينا كمال صبحي',
    avatar: 'م ص',
    avatarColor: '#DB2777',
    grade: 'الثاني الابتدائي',
    absenceDuration: 'غائبة منذ أسبوعين',
    lastContact: 'تم التواصل - رسالة',
    status: 'تحتاج مكالمة ترحيب',
    type: 'رسالة',
    notes: '',
    urgency: 'normal',
  },
  {
    id: 3,
    studentId: 6,
    studentName: 'مينا تادرس فوزي',
    avatar: 'م ت',
    avatarColor: '#16A34A',
    grade: 'الخامس الابتدائي',
    absenceDuration: 'غائب منذ أسبوعين',
    lastContact: 'زيارة مجدولة',
    status: 'زيارة مجدولة',
    type: 'زيارة',
    notes: '',
    urgency: 'normal',
  },
];

// Recent follow-up logs
export const followUpLogs = [
  {
    id: 1,
    studentName: 'يوحنا عماد',
    time: 'منذ ساعتين',
    type: 'زيارة',
    notes: 'زيارة منزلية: الأسرة ترحب بالخادم. الطالب سيعود للحضور القادم.',
  },
  {
    id: 2,
    studentName: 'ديفيد نبيل',
    time: 'أمس 4:30 م',
    type: 'مكالمة',
    notes: 'مكالمة هاتفية: الطالب مريض قليلاً. تم الصلاة معه هاتفياً.',
  },
  {
    id: 3,
    studentName: 'توماس أشرف',
    time: 'أمس 11:00 ص',
    type: 'رسالة',
    notes: 'رسالة واتساب: تم إرسال مادة الدرس وتحديد موعد للزيارة.',
  },
];

// Dashboard stats
export const dashboardStats = {
  totalStudents: 42,
  presentToday: 28,
  absentToday: 10,
  excusedToday: 4,
  needFollowUp: 8,
  attendanceRate: 85,
};

// Important alerts
export const alerts = [
  {
    id: 1,
    type: 'birthday',
    icon: '🎂',
    title: 'عيد ميلاد اليوم',
    text: '٣ طلاب لديهم أعياد ميلاد اليوم. لا تنسَ المعايدة!',
    color: 'gold',
  },
  {
    id: 2,
    type: 'meeting',
    icon: '📋',
    title: 'اجتماع الخدام',
    text: 'اليوم في تمام الساعة ٧ مساءً في القاعة المعروفة.',
    color: 'red',
  },
];

// Absent today (for dashboard)
export const absentToday = students.filter(s =>
  todayAttendance.records[s.id] === 'غائب'
);

// ── SERVANTS SYSTEM (Mock Data) ──

export const servantRoles = [
  { id: 'all', label: 'الكل' },
  { id: 'الأمانة العامة', label: 'الأمانة العامة' },
  { id: 'أمين خدمة', label: 'أمين خدمة' },
  { id: 'خادم مرحلة', label: 'خادم مرحلة' },
];

export const servantStages = [
  { id: 'all',     label: 'الكل'     },
  { id: 'حضانة',  label: 'حضانة'    },
  { id: 'ابتدائي', label: 'ابتدائي'  },
  { id: 'إعدادي', label: 'إعدادي'   },
  { id: 'ثانوي',  label: 'ثانوي'    },
  { id: 'جامعة',  label: 'جامعة'    },
  { id: 'خريجين', label: 'خريجين'   },
];

export const servants = [
  {
    id: 1,
    name: 'مينا كمال',
    email: 'mina.k@stmary.org',
    role: 'أمين خدمة',
    stage: 'ابتدائي',
    status: 'نشط',
    avatar: 'م ك',
    avatarColor: '#1D4ED8',
    phone: '01234567890',
  },
  {
    id: 2,
    name: 'أبانوب فايز',
    email: 'abanoub.f@stmary.org',
    role: 'الأمانة العامة',
    stage: 'خريجين',
    status: 'غير نشط',
    avatar: 'أ ف',
    avatarColor: '#EA580C',
    phone: '01123456789',
  },
  {
    id: 3,
    name: 'مريم جرجس',
    email: 'maryam.g@stmary.org',
    role: 'خادم مرحلة',
    stage: 'إعدادي',
    status: 'نشط',
    avatar: 'م ج',
    avatarColor: '#0D9488',
    phone: '01098765432',
  },
  {
    id: 4,
    name: 'سارة رأفت',
    email: 'sara.r@stmary.org',
    role: 'خادم مرحلة',
    stage: 'ابتدائي',
    status: 'نشط',
    avatar: 'س ر',
    avatarColor: '#DC2626',
    phone: '01567891234',
  },
];

