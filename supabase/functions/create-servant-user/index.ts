// supabase/functions/create-servant-user/index.ts
//
// Deploy:   supabase functions deploy create-servant-user
// Secret:   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SERVICE_ROLE_KEY')!;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 1. Verify caller JWT ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized — invalid or expired session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 2. Fetch caller profile ───────────────────────────────────────────────
    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, role, assigned_grades')
      .eq('id', callerUser.id)
      .single();

    if (profileErr || !callerProfile) {
      return new Response(JSON.stringify({ error: 'Could not fetch caller profile' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const callerRole = callerProfile.role;

    // ── 3. Parse body ─────────────────────────────────────────────────────────
    const body = await req.json();
    const {
      email, temporaryPassword, full_name, role,
      assigned_grade, assigned_grades, assigned_gender,
      phone, address, confession_father, job, status, talents, notes,
    } = body;

    // Basic validation
    if (!email || !temporaryPassword || !full_name || !role) {
      return new Response(JSON.stringify({ error: 'حقول مطلوبة مفقودة: email, temporaryPassword, full_name, role' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (temporaryPassword.length < 8) {
      return new Response(JSON.stringify({ error: 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 4. Permission check ───────────────────────────────────────────────────
    const ALLOWED = ['ADMIN', 'GENERAL_SECRETARIAT', 'SERVICE_HEAD'];
    if (!ALLOWED.includes(callerRole)) {
      return new Response(JSON.stringify({ error: 'غير مسموح — دورك لا يتيح إنشاء مستخدمين' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (callerRole === 'SERVICE_HEAD') {
      if (role !== 'SERVANT') {
        return new Response(JSON.stringify({ error: 'غير مسموح — أمين الخدمة يمكنه إنشاء خدام مرحلة فقط' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const myGrades: string[] = Array.isArray(callerProfile.assigned_grades) ? callerProfile.assigned_grades : [];
      if (!assigned_grade || !myGrades.includes(assigned_grade)) {
        return new Response(JSON.stringify({ error: 'غير مسموح — المرحلة المختارة خارج نطاق إشرافك' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── 5. Create Auth user ───────────────────────────────────────────────────
    const { data: authData, error: createErr } = await adminClient.auth.admin.createUser({
      email:         email.trim().toLowerCase(),
      password:      temporaryPassword.trim(),
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    });

    if (createErr || !authData?.user) {
      const msg = createErr?.message || 'Failed to create auth user';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return new Response(JSON.stringify({ error: 'هذا البريد الإلكتروني مسجّل مسبقاً في النظام.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const newUserId = authData.user.id;

    // ── 6. Insert profile row ─────────────────────────────────────────────────
    const profilePayload = {
      id:                newUserId,
      full_name:         full_name.trim(),
      role,
      assigned_gender:   assigned_gender   || null,
      assigned_grade:    role === 'SERVANT'      ? (assigned_grade  || null) : null,
      assigned_grades:   role === 'SERVICE_HEAD' ? (Array.isArray(assigned_grades) && assigned_grades.length > 0 ? assigned_grades : null) : null,
      email:             email.trim().toLowerCase(),
      confession_father: confession_father || null,
      address:           address           || null,
      job:               job               || null,
      phone:             phone             || null,
      status:            status            || 'نشط',
      talents:           talents           || null,
      notes:             notes             || null,
    };

    const { data: profileData, error: insertErr } = await adminClient
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select()
      .single();

    if (insertErr) {
      // Rollback: delete the auth user so we don't leave an orphaned account
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: `فشل إنشاء الملف الشخصي (تم حذف الحساب): ${insertErr.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 7. Success ────────────────────────────────────────────────────────────
    const result = { id: newUserId, email: authData.user.email, full_name: profileData.full_name, role: profileData.role, isNew: true };
    return new Response(JSON.stringify({ success: true, data: result, ...result }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});
