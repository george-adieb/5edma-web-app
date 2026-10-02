import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

const PROMOTION_MAP: Record<string, string> = {
  'حضانه أولى': 'حضانه ثانية',
  'حضانه ثانية': 'أولى ابتدائي',
  'الأول الابتدائي': 'الثاني الابتدائي',
  'الثاني الابتدائي': 'الثالث الابتدائي',
  'الثالث الابتدائي': 'الرابع الابتدائي',
  'الرابع الابتدائي': 'الخامس الابتدائي',
  'الخامس الابتدائي': 'السادس الابتدائي',
  'السادس الابتدائي': 'الأول الإعدادي',
  'الأول الإعدادي': 'الثاني الإعدادي',
  'الثاني الإعدادي': 'الثالث الإعدادي',
  'الثالث الإعدادي': 'الأول الثانوي',
  'الأول الثانوي': 'الثاني الثانوي',
  'الثاني الثانوي': 'الثالث الثانوي',
  'الثالث الثانوي': 'خريجين'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    console.log('yearly-promotion called');
    
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    
    console.log('action:', action);

    if (!action) {
      return jsonResponse({
        success: false,
        message: 'نوع العملية غير محدد'
      }, 400);
    }

    if (action !== 'preview' && action !== 'execute') {
      return jsonResponse({
        success: false,
        message: 'نوع العملية غير صحيح'
      }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({
        success: false,
        message: 'يجب تسجيل الدخول أولًا'
      }, 401);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return jsonResponse({
        success: false,
        message: 'يجب تسجيل الدخول أولًا'
      }, 401);
    }

    console.log('user:', user.id);

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('profile role:', profile?.role);

    if (profileError || !profile || profile.role !== 'ADMIN') {
      return jsonResponse({
        success: false,
        message: 'غير مصرح لك بتنفيذ ترحيل السنة الدراسية'
      }, 403);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (action === 'preview') {
      let studentsCount = 0;
      let profilesCount = 0;

      const { data: students } = await supabaseAdmin.from('students').select('grade');
      if (students) {
        studentsCount = students.filter((s: any) => Object.keys(PROMOTION_MAP).includes(s.grade)).length;
      }

      const { data: profilesList } = await supabaseAdmin.from('profiles').select('assigned_grade, assigned_grades');
      if (profilesList) {
        for (const p of profilesList) {
          let affected = false;
          if (p.assigned_grade && Object.keys(PROMOTION_MAP).includes(p.assigned_grade)) affected = true;
          if (p.assigned_grades && Array.isArray(p.assigned_grades)) {
            if (p.assigned_grades.some((g: any) => Object.keys(PROMOTION_MAP).includes(g))) affected = true;
          }
          if (affected) profilesCount++;
        }
      }

      return jsonResponse({
        success: true,
        action: 'preview',
        studentsPreview: [],
        profilesPreview: [],
        totals: {
          students: studentsCount,
          profiles: profilesCount
        }
      }, 200);

    } else if (action === 'execute') {
      const { confirmationText, promotionYear } = body;
      
      if (confirmationText !== 'أوافق على ترحيل السنة الدراسية') {
        return jsonResponse({
          success: false,
          message: 'نص التأكيد غير صحيح'
        }, 400);
      }
      if (!promotionYear) {
        return jsonResponse({
          success: false,
          message: 'يجب تحديد السنة الدراسية للترحيل'
        }, 400);
      }

      // Check log table using admin client
      const { data: existingLog } = await supabaseAdmin
        .from('yearly_promotion_logs')
        .select('id')
        .eq('promotion_year', promotionYear)
        .maybeSingle();

      if (existingLog) {
        return jsonResponse({
          success: false,
          message: 'تم تنفيذ ترحيل هذه السنة من قبل'
        }, 400);
      }

      // Execute RPC
      const { data, error } = await supabaseAdmin.rpc('execute_yearly_promotion', {
        p_executed_by: user.id,
        p_promotion_year: promotionYear
      });

      if (error) {
        throw error;
      }

      return jsonResponse({
        success: true,
        message: 'تم ترحيل السنة الدراسية بنجاح',
        totals: {
          students: data?.affected_students_count || 0,
          profiles: data?.affected_profiles_count || 0
        }
      }, 200);
    }

  } catch (error: any) {
    console.error('yearly-promotion error:', error);
    return jsonResponse({
      success: false,
      message: 'حدث خطأ أثناء معالجة ترحيل السنة الدراسية',
      error: error?.message || String(error),
    }, 500);
  }
});
