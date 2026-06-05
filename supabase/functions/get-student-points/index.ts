// supabase/functions/get-student-points/index.ts
//
// Public edge function — no caller auth required.
// Uses service role key internally so RLS is bypassed safely.
//
// Deploy:  supabase functions deploy get-student-points
// Secret:  supabase secrets set SERVICE_ROLE_KEY=<your-service-role-key>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY   = Deno.env.get('SERVICE_ROLE_KEY')!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
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
  // ── Handle CORS preflight ────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // ── 1. Parse and validate input ──────────────────────────────────────────
    let body: { code?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const rawCode = body?.code;
    if (!rawCode || typeof rawCode !== 'string') {
      return jsonResponse({ error: 'INVALID_CODE' }, 400);
    }

    // ── 2. Normalize code ────────────────────────────────────────────────────
    const inputCode = rawCode.trim().toUpperCase();
    if (!inputCode) {
      return jsonResponse({ error: 'INVALID_CODE' }, 400);
    }

    // ── 3. Find student by code ──────────────────────────────────────────────
    // Try students.code first. If points_access_code column exists and doesn't
    // match, we fall back to it — but since per the spec it equals students.code,
    // a single OR filter is sufficient. We guard with try/catch in case the
    // points_access_code column doesn't exist yet.
    let student: { id: string; name: string; grade: string | null } | null = null;

    // Primary lookup: students.code
    {
      const { data, error } = await adminClient
        .from('students')
        .select('id, name, grade')
        .eq('code', inputCode)
        .maybeSingle();

      if (error) {
        console.error('[get-student-points] primary lookup error:', error);
        return jsonResponse({ error: 'LOOKUP_ERROR' }, 500);
      }
      if (data) student = data;
    }

    // Fallback: points_access_code (if the column exists)
    if (!student) {
      try {
        const { data, error } = await adminClient
          .from('students')
          .select('id, name, grade')
          .eq('points_access_code', inputCode)
          .maybeSingle();

        // If this fails with an "unknown column" type error, just skip.
        if (!error && data) student = data;
      } catch {
        // Column doesn't exist — ignore silently
      }
    }

    if (!student) {
      return jsonResponse({ error: 'INVALID_CODE' }, 404);
    }

    const studentId = student.id;

    // ── 4. Fetch total points and latest 10 logs in parallel ─────────────────
    const [summaryResult, logsResult] = await Promise.all([
      // Total points: SUM via student_points_summary view if it exists,
      // otherwise fall back to raw table aggregation
      adminClient
        .from('student_points_summary')
        .select('total_points')
        .eq('student_id', studentId)
        .maybeSingle(),

      // Latest 10 logs — only safe fields, NO student UUIDs, NO servant info
      adminClient
        .from('student_points_logs')
        .select('points, reason, source, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Calculate total points
    let totalPoints = 0;
    if (summaryResult.data) {
      totalPoints = summaryResult.data.total_points ?? 0;
    } else {
      // Fallback: manually sum from the logs table
      const { data: allLogs } = await adminClient
        .from('student_points_logs')
        .select('points')
        .eq('student_id', studentId);
      totalPoints = (allLogs || []).reduce((acc, l) => acc + (l.points ?? 0), 0);
    }

    // Safe logs list — only the explicitly whitelisted fields
    const logs = (logsResult.data || []).map((log) => ({
      points:     log.points,
      reason:     log.reason,
      source:     log.source,
      created_at: log.created_at,
    }));

    // ── 5. Return safe response ──────────────────────────────────────────────
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
