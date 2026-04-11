export const GRADES = [
  { id: '', label: 'اختر المرحلة' },
  { id: 'kg1', label: 'حضانة أولى' },
  { id: 'kg2', label: 'حضانة ثانية' },
  { id: 'grade1', label: 'الأول الابتدائي' },
  { id: 'grade2', label: 'الثاني الابتدائي' },
  { id: 'grade3', label: 'الثالث الابتدائي' },
  { id: 'grade4', label: 'الرابع الابتدائي' },
  { id: 'grade5', label: 'الخامس الابتدائي' },
  { id: 'grade6', label: 'السادس الابتدائي' },
  { id: 'grade7', label: 'الأول الإعدادي' },
  { id: 'grade8', label: 'الثاني الإعدادي' },
  { id: 'grade9', label: 'الثالث الإعدادي' },
  { id: 'grade10', label: 'الأول الثانوي' },
  { id: 'grade11', label: 'الثاني الثانوي' },
  { id: 'grade12', label: 'الثالث الثانوي' },
  { id: 'uni', label: 'الجامعة' },
  { id: 'grad', label: 'الخريجين' },
];

export const GRADE_LABEL_MAP = GRADES.reduce((acc, g) => {
  if (g.id) acc[g.id] = g.label;
  return acc;
}, {});

export const REVERSE_GRADE_MAP = GRADES.reduce((acc, g) => {
  if (g.id) acc[g.label] = g.id;
  return acc;
}, {});
