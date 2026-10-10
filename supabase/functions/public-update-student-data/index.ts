// supabase/functions/public-update-student-data/index.ts
//
// PUBLIC edge function (deploy with --no-verify-jwt).
// Actions: list_students | verify_student | submit_update
//
// Identity check: the caller must supply a mobile number matching ANY stored
// phone field of the selected student (old data may mix student/guardian
// numbers). Stored phones are never returned to the caller. submit_update
// re-verifies the phone on every call (stateless, no sessions).
//
// Deploy:  supabase functions deploy public-update-student-data --no-verify-jwt
// Secret:  supabase secrets set SERVICE_ROLE_KEY=<your-service-role-key>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MISMATCH_MESSAGE = 'الرقم غير مطابق للبيانات المسجلة';

// Phone columns on `students` (student_phone exists after the 20261010 migration).
// Verification reads whichever of these are present on the row.
const PHONE_FIELDS = ['parent_phone', 'parent_phone_2', 'student_phone'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Arabic-Indic / Persian digits → ASCII, strip everything but digits.
function digitsOnly(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\D/g, '');
}

// Returns every equivalent form of the number (international 20… and local 01…).
function phoneVariants(raw: unknown): string[] {
  let n = digitsOnly(raw); // removes spaces, dashes, parentheses, +
  if (!n) return [];
  if (n.startsWith('0020')) n = '20' + n.slice(4);
  const out = new Set<string>([n]);
  if (n.startsWith('20') && n.length === 12) out.add('0' + n.slice(2));
  if (n.startsWith('01') && n.length === 11) out.add('20' + n.slice(1));
  return [...out];
}

function phonesMatch(input: string, stored: unknown[]): boolean {
  const inputVars = phoneVariants(input);
  if (inputVars.length === 0) return false;
  // Require a plausible number so very short input can never match.
  if (!inputVars.some((v) => v.length >= 10)) return false;
  for (const s of stored) {
    const sv = phoneVariants(s);
    if (sv.some((v) => inputVars.includes(v))) return true;
  }
  return false;
}

// Best-effort brute-force throttle (per isolate): 8 failures / 10 min per student+IP.
const failures = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 8;
function throttleKey(req: Request, studentId: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return `${ip}:${studentId}`;
}
function isThrottled(key: string) {
  const e = failures.get(key);
  if (!e) return false;
  if (Date.now() - e.first > WINDOW_MS) { failures.delete(key); return false; }
  return e.count >= MAX_FAILS;
}
function recordFailure(key: string) {
  const e = failures.get(key);
  if (!e || Date.now() - e.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else e.count++;
}

// Verifies the phone against the stored student record. Server-side only.
async function verify(req: Request, studentId: unknown, phone: unknown):
  Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (typeof studentId !== 'string' || !studentId || typeof phone !== 'string' || !phone.trim()) {
    return { ok: false, status: 400, message: MISMATCH_MESSAGE };
  }
  const key = throttleKey(req, studentId);
  if (isThrottled(key)) {
    return { ok: false, status: 429, message: 'محاولات كثيرة. حاول مرة أخرى بعد قليل' };
  }
  const { data, error } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('id', studentId)
    .maybeSingle();
  if (error) {
    console.error('[public-update-student-data] verify lookup:', error.message);
    return { ok: false, status: 500, message: 'حدث خطأ غير متوقع' };
  }
  if (!data || !phonesMatch(phone, PHONE_FIELDS.map((f) => (data as Record<string, unknown>)[f]))) {
    recordFailure(key);
    return { ok: false, status: 200, message: MISMATCH_MESSAGE };
  }
  failures.delete(key);
  return { ok: true };
}

const str = (v: unknown, max = 500) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ success: false, message: 'طلب غير صالح' }, 400); }

  try {
    switch (body.action) {
      // ── 1. list_students — minimal public fields only ──────────────────────
      case 'list_students': {
        const { data, error } = await supabaseAdmin
          .from('students')
          .select('id, name, grade, gender')
          .order('name', { ascending: true });
        if (error) {
          console.error('[public-update-student-data] list:', error.message);
          return json({ success: false, message: 'حدث خطأ غير متوقع' }, 500);
        }
        return json({
          success: true,
          students: (data || []).map((s) => ({
            id: s.id, full_name: s.name, grade: s.grade, gender: s.gender,
          })),
        });
      }

      // ── 2. verify_student ──────────────────────────────────────────────────
      case 'verify_student': {
        const v = await verify(req, body.student_id, body.phone_number);
        if (!v.ok) return json({ success: false, message: v.message }, v.status === 200 ? 200 : v.status);
        return json({ success: true });
      }

      // ── 3. submit_update — always re-verifies the phone ────────────────────
      case 'submit_update': {
        const v = await verify(req, body.student_id, body.verification_phone);
        if (!v.ok) return json({ success: false, message: v.message }, v.status === 200 ? 403 : v.status);

        const d = (body.data && typeof body.data === 'object' ? body.data : {}) as Record<string, unknown>;

        // Whitelist: only these columns can ever be written. Empty values are
        // skipped so a blank field never wipes existing data.
        const hobbies = typeof d.hobbies === 'string'
          ? d.hobbies.split(/[،,]/).map((h) => h.trim()).filter(Boolean).slice(0, 20)
          : [];
        const gender = str(d.gender, 10);
        const lat = Number(d.latitude), lng = Number(d.longitude);
        const hasLoc = d.latitude != null && d.longitude != null && d.latitude !== '' && d.longitude !== ''
          && Number.isFinite(lat) && Number.isFinite(lng)
          && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        const candidate: Record<string, unknown> = {
          name:           str(d.name, 200),
          birth_date:     str(d.birth_date, 20),
          gender:         gender === 'ذكر' || gender === 'أنثى' ? gender : null,
          grade:          str(d.grade, 60),
          school:         str(d.school, 200),
          mother_name:    str(d.mother_name, 200),
          parent_phone:   str(d.parent_phone, 20),
          student_phone:  str(d.student_phone, 20),
          address:        str(d.address, 500),
          latitude:       hasLoc ? lat : null,
          longitude:      hasLoc ? lng : null,
          location_updated_at: hasLoc ? new Date().toISOString() : null,
          notes:          str(d.notes, 1000),
          hobbies:        hobbies.length ? hobbies : null,
        };
        // `notes` may already hold servants' notes: append, never overwrite.
        if (candidate.notes) {
          const { data: cur } = await supabaseAdmin.from('students').select('notes').eq('id', body.student_id as string).maybeSingle();
          const old = typeof cur?.notes === 'string' ? cur.notes.trim() : '';
          if (old) candidate.notes = `${old}\n---\n${candidate.notes}`;
        }
        const update: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(candidate)) if (val !== null) update[k] = val;

        if (Object.keys(update).length === 0) {
          return json({ success: false, message: 'من فضلك أدخل البيانات المطلوبة' }, 400);
        }

        const { error } = await supabaseAdmin.from('students').update(update).eq('id', body.student_id as string);
        if (error) {
          console.error('[public-update-student-data] update:', error.message);
          return json({ success: false, message: 'تعذّر حفظ البيانات' }, 500);
        }
        return json({ success: true });
      }

      default:
        return json({ success: false, message: 'Unknown action' }, 400);
    }
  } catch (err) {
    console.error('[public-update-student-data] unexpected:', err);
    return json({ success: false, message: 'حدث خطأ غير متوقع' }, 500);
  }
});
