import { supabase } from './supabase';

export const ROLE_LABELS = {
  ADMIN: 'مدير النظام',
  GENERAL_SECRETARIAT: 'مدير النظام',
  SERVICE_HEAD: 'أمين خدمة',
  SERVANT: 'خادم',
};

export const ROLE_BADGE = {
  ADMIN: { bg: '#FEE2E2', color: '#8B1A1A' },
  GENERAL_SECRETARIAT: { bg: '#FEE2E2', color: '#8B1A1A' },
  SERVICE_HEAD: { bg: '#FEF3C7', color: '#B45309' },
  SERVANT: { bg: '#EEF2FF', color: '#4F46E5' },
};

// DB stores ذكر / أنثى; the UI speaks بنين / بنات.
export const GENDER_OPTIONS = [
  { value: 'ذكر', label: 'بنين' },
  { value: 'أنثى', label: 'بنات' },
];
export const genderLabel = (g) => GENDER_OPTIONS.find(o => o.value === g)?.label || '—';

/** Grade text shown for a profile (servants have one grade, leaders many). */
export function gradesOf(u) {
  if (u.role === 'SERVICE_HEAD') return Array.isArray(u.assigned_grades) ? u.assigned_grades : [];
  if (u.role === 'SERVANT') return u.assigned_grade ? [u.assigned_grade] : [];
  return [];
}
export const gradeText = (u) => {
  if (u.role === 'ADMIN' || u.role === 'GENERAL_SECRETARIAT') return 'كل المراحل';
  return gradesOf(u).join('، ') || '—';
};

async function invoke(fn, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('انتهت جلسة الدخول، برجاء تسجيل الدخول مرة أخرى');

  const { data, error } = await supabase.functions.invoke(fn, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const listUsers      = () => invoke('manage-users', { action: 'list' });
export const updateUser     = (user_id, changes) => invoke('manage-users', { action: 'update', user_id, ...changes });
export const deleteUser     = (user_id) => invoke('manage-users', { action: 'delete', user_id });
export const deactivateUser = (user_id) => invoke('manage-users', { action: 'deactivate', user_id });
export const reactivateUser = (user_id) => invoke('manage-users', { action: 'reactivate', user_id });
export const isInactive = (u) => u?.status === 'غير نشط' || u?.status === 'inactive';

export const resetPassword  = (user_id, password) => invoke('manage-users', { action: 'reset_password', user_id, password });

/** Mirrors the server rule (cleanPassword). Returns an Arabic error or ''. */
export function passwordError(pw, confirm) {
  if (!pw || pw.length < 8) return 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل';
  if (pw.length > 72) return 'كلمة المرور طويلة جدًا (الحد الأقصى ٧٢ حرفاً)';
  if (!/\p{L}/u.test(pw) || !/\d/u.test(pw)) return 'كلمة المرور ضعيفة — يجب أن تحتوي على حروف وأرقام';
  if (confirm !== undefined && pw !== confirm) return 'كلمتا المرور غير متطابقتين';
  return '';
}
export const createUser     = (payload) => invoke('create-servant-user', payload);

/** Admin-only (enforced by RLS on user_audit_logs). */
export async function fetchAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from('user_audit_logs')
    .select('id, actor_id, target_id, action, previous_state, new_state, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
