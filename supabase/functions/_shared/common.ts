// Shared helpers for the user-management Edge Functions.
// Every privileged decision is made here, server-side, from data loaded from
// the database — never from role/scope values sent by the browser.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!;

export const adminClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Constants (must mirror src/data/constants.js and profiles.role values) ──
export const ROLE_ADMIN        = 'ADMIN';
export const ROLE_SERVICE_HEAD = 'SERVICE_HEAD';
export const ROLE_SERVANT      = 'SERVANT';
export const MANAGEABLE_ROLES  = [ROLE_SERVANT, ROLE_SERVICE_HEAD];
export const ADMIN_LIKE_ROLES  = ['ADMIN', 'GENERAL_SECRETARIAT'];

export const GENDERS = ['ذكر', 'أنثى']; // shown in the UI as بنين / بنات
export const GRADES = [
  'حضانة أولى', 'حضانة ثانية', 'الأول الابتدائي', 'الثاني الابتدائي', 'الثالث الابتدائي',
  'الرابع الابتدائي', 'الخامس الابتدائي', 'السادس الابتدائي', 'الأول الإعدادي',
  'الثاني الإعدادي', 'الثالث الإعدادي', 'الأول الثانوي', 'الثاني الثانوي',
  'الثالث الثانوي', 'الجامعة', 'الخريجين',
];

export const PROFILE_COLUMNS =
  'id, full_name, email, role, assigned_grade, assigned_grades, assigned_gender, status, phone, created_at';

// ── HTTP helpers ─────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);

export function corsFor(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allow = ALLOWED_ORIGINS.length === 0 ? '*' : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  });
}

/** Wraps a handler: CORS preflight, POST-only, JSON body, uniform error shape. */
export function serveJson(handler: (req: Request, body: any) => Promise<unknown>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsFor(req) });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
      const body = await req.json().catch(() => { throw new HttpError(400, 'طلب غير صالح'); });
      if (!body || typeof body !== 'object') throw new HttpError(400, 'طلب غير صالح');
      return json(req, await handler(req, body));
    } catch (e) {
      if (e instanceof HttpError) return json(req, { error: e.message }, e.status);
      console.error('[user-mgmt] unexpected error:', e);
      return json(req, { error: 'حدث خطأ غير متوقع' }, 500);
    }
  });
}

// ── Caller authentication ────────────────────────────────────────────────────
export interface Profile {
  id: string; full_name: string | null; email: string | null; role: string;
  assigned_grade: string | null; assigned_grades: string[] | null;
  assigned_gender: string | null; status: string | null; phone?: string | null; created_at?: string;
}

/** Validates the JWT with Supabase Auth, then loads the caller's CURRENT profile. */
export async function authenticate(req: Request): Promise<Profile> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'غير مصرّح — يلزم تسجيل الدخول');

  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'انتهت الجلسة أو غير صالحة — سجّل الدخول مرة أخرى');

  const { data: profile, error: pErr } = await adminClient
    .from('profiles').select(PROFILE_COLUMNS).eq('id', data.user.id).maybeSingle();
  if (pErr || !profile) throw new HttpError(403, 'تعذّر العثور على ملف المستخدم');
  if (profile.status === 'غير نشط' || profile.status === 'inactive') {
    throw new HttpError(403, 'هذا الحساب غير نشط');
  }
  return profile as Profile;
}

export const isAdmin       = (p: Profile) => p.role === ROLE_ADMIN;
export const isServiceHead = (p: Profile) => p.role === ROLE_SERVICE_HEAD;

/** Grades a SERVICE_HEAD manages (same rule as get_current_user_managed_grades()). */
export function managedGrades(p: Profile): string[] {
  if (Array.isArray(p.assigned_grades) && p.assigned_grades.length) return p.assigned_grades;
  return p.assigned_grade ? [p.assigned_grade] : [];
}

export const isActive = (p: { status?: string | null }) => !['غير نشط', 'inactive'].includes(p.status ?? 'نشط');

/** Every grade a profile is assigned to (single + multi), de-duplicated. */
export function allGrades(p: Pick<Profile, 'assigned_grade' | 'assigned_grades'>): string[] {
  return [...new Set([...(p.assigned_grades ?? []), ...(p.assigned_grade ? [p.assigned_grade] : [])])];
}

type ServantLike = Pick<Profile, 'role' | 'assigned_grade' | 'assigned_grades' | 'assigned_gender' | 'status'>;

function leaderMatch(head: Profile, target: ServantLike, requireAll: boolean): boolean {
  if (head.role !== ROLE_SERVICE_HEAD || !isActive(head) || !head.assigned_gender) return false;
  if (target.role !== ROLE_SERVANT || !isActive(target)) return false;
  if (!target.assigned_gender || target.assigned_gender !== head.assigned_gender) return false;   // gender is mandatory
  const grades = allGrades(target);
  const mine = managedGrades(head);
  if (!grades.length || !mine.length) return false;                                              // empty ≠ unrestricted
  return requireAll ? grades.every(g => mine.includes(g)) : grades.some(g => mine.includes(g));
}

/** SEE: active servant, same gender, at least one grade in common. Mirrors SQL leader_can_see(). */
export const leaderSees = (head: Profile, target: ServantLike) => leaderMatch(head, target, false);
/** MANAGE (edit / reset password / deactivate): same, but EVERY grade of the servant must be the leader's. */
export const leaderManages = (head: Profile, target: ServantLike) => leaderMatch(head, target, true);

// ── Input validation ─────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanName(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (s.length < 2 || s.length > 120) throw new HttpError(400, 'الاسم بالكامل مطلوب (٢–١٢٠ حرفاً)');
  return s;
}
export function cleanEmail(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(s) || s.length > 254) throw new HttpError(400, 'البريد الإلكتروني غير صحيح');
  return s;
}
/** Min 8 chars, at least one letter and one digit, not the email/name. Never logged or echoed. */
export function cleanPassword(v: unknown, email?: string): string {
  const s = typeof v === 'string' ? v : '';
  if (s.length < 8 || s.length > 72) throw new HttpError(400, 'كلمة المرور يجب أن تكون من ٨ إلى ٧٢ حرفاً');
  if (!/\p{L}/u.test(s) || !/\d/u.test(s)) throw new HttpError(400, 'كلمة المرور ضعيفة — يجب أن تحتوي على حروف وأرقام');
  if (/^(.)\1+$/u.test(s) || (email && s.toLowerCase() === email.toLowerCase())) throw new HttpError(400, 'كلمة المرور ضعيفة — اختر كلمة مرور أقوى');
  return s;
}
export function cleanGender(v: unknown): string {
  if (typeof v !== 'string' || !GENDERS.includes(v)) throw new HttpError(400, 'يرجى اختيار بنين أو بنات');
  return v;
}
export function cleanGrade(v: unknown): string {
  if (typeof v !== 'string' || !GRADES.includes(v)) throw new HttpError(400, 'المرحلة الدراسية غير صالحة');
  return v;
}
export function cleanGrades(v: unknown): string[] {
  if (!Array.isArray(v) || v.length === 0) throw new HttpError(400, 'يرجى اختيار مرحلة واحدة على الأقل');
  return [...new Set(v.map(cleanGrade))];
}

/**
 * Canonical assignment shape used across the app:
 *   SERVANT       → assigned_grade = one label, assigned_grades = null
 *   SERVICE_HEAD  → assigned_grades = labels[],  assigned_grade = null
 */
export function assignmentFor(role: string, grades: string[]) {
  return role === ROLE_SERVICE_HEAD
    ? { assigned_grade: null, assigned_grades: grades }
    : { assigned_grade: grades[0] ?? null, assigned_grades: null };
}

export const snapshot = (p: Partial<Profile>) => ({
  full_name: p.full_name ?? null, email: p.email ?? null, role: p.role ?? null,
  assigned_grade: p.assigned_grade ?? null, assigned_grades: p.assigned_grades ?? null,
  assigned_gender: p.assigned_gender ?? null,
  status: p.status ?? null,
});

export async function writeAudit(
  actorId: string, targetId: string, action: string, previous: unknown, next: unknown,
) {
  const { error } = await adminClient.from('user_audit_logs').insert({
    actor_id: actorId, target_id: targetId, action, previous_state: previous, new_state: next,
  });
  if (error) throw new Error(`audit log failed: ${error.message}`);
}
