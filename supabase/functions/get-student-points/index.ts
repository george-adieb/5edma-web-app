// supabase/functions/get-student-points/index.ts
//
// PUBLIC edge function — no caller auth required.
// JWT verification is disabled via supabase/config.toml or the deploy flag:
//   supabase functions deploy get-student-points --no-verify-jwt
//
// Uses service role key internally so RLS is bypassed safely.
// Students call this page anonymously — no login needed.
//
// Deploy:  supabase functions deploy get-student-points --no-verify-jwt
// Secret:  supabase secrets set SERVICE_ROLE_KEY=<your-service-role-key>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

// Admin client — uses service role so RLS is bypassed.
// Never exposed to the caller; only used inside this function.
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // ── CORS preflight ────────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // ── 1. Parse body ─────────────────────────────────────────────────────────
    let body: { code?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'INVALID_CODE' }, 400);
    }

    const rawCode = body?.code;
    if (!rawCode || typeof rawCode !== 'string') {
      return jsonResponse({ error: 'INVALID_CODE' }, 400);
    }

    // ── 2. Normalize code ─────────────────────────────────────────────────────
    const inputCode = rawCode.trim().toUpperCase();
    if (!inputCode) {
      return jsonResponse({ error: 'INVALID_CODE' }, 400);
    }

    // ── 3. Find student ───────────────────────────────────────────────────────
    // No auth check, no getUser() — purely code-based lookup via service role.
    // Only safe fields selected: id (needed for points lookup), name, grade.
    let student: { id: string; name: string; grade: string | null } | null = null;

    // Primary: students.code
    {
      const { data, error } = await supabaseAdmin
        .from('students')
        .select('id, name, grade')
        .eq('code', inputCode)
        .maybeSingle();

      if (error) {
        console.error('[get-student-points] lookup error:', error.message);
        return jsonResponse({ error: 'LOOKUP_ERROR' }, 500);
      }
      if (data) student = data;
    }

    // Fallback: points_access_code (gracefully ignored if column doesn't exist)
    if (!student) {
      try {
        const { data, error } = await supabaseAdmin
          .from('students')
          .select('id, name, grade')
          .eq('points_access_code', inputCode)
          .maybeSingle();
        if (!error && data) student = data;
      } catch {
        // Column doesn't exist — skip silently
      }
    }

    if (!student) {
      return jsonResponse({ error: 'INVALID_CODE' }, 404);
    }

    const studentId = student.id;

    // ── 4. Points summary + latest 10 logs (parallel) ─────────────────────────
    const [summaryResult, logsResult] = await Promise.all([
      supabaseAdmin
        .from('student_points_summary')
        .select('total_points')
        .eq('student_id', studentId)
        .maybeSingle(),

      supabaseAdmin
        .from('student_points_logs')
        .select('points, reason, source, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Total points — fall back to manual SUM if the summary view is unavailable
    let totalPoints = 0;
    if (summaryResult.data) {
      totalPoints = summaryResult.data.total_points ?? 0;
    } else {
      const { data: allLogs } = await supabaseAdmin
        .from('student_points_logs')
        .select('points')
        .eq('student_id', studentId);
      totalPoints = (allLogs || []).reduce((acc, l) => acc + (l.points ?? 0), 0);
    }

    // Safe log list — only whitelisted fields, no UUIDs, no servant data
    const logs = (logsResult.data || []).map((log) => ({
      points:     log.points,
      reason:     log.reason,
      source:     log.source,
      created_at: log.created_at,
    }));

    // ── 5. Safe response ──────────────────────────────────────────────────────
    // No student UUID, no phone, no address, no medical notes, no servant data.
    return jsonResponse({
      student_name: student.name,
      grade:        student.grade ?? '',
      total_points: totalPoints,
      logs,
    });

  } catch (err) {
    console.error('[get-student-points] unexpected error:', err);
    return jsonResponse({ error: 'INTERNAL_ERROR' }, 500);
  }
});
