// supabase/functions/create-servant-user/index.ts
//
// Creates a Servant or Service Leader (SERVICE_HEAD).
//   ADMIN         → may create SERVANT or SERVICE_HEAD (never ADMIN)
//   SERVICE_HEAD  → may create SERVANT only, inside own grades + gender
// The caller supplies an initial password; Supabase Auth hashes and stores it.
// It is never saved in public tables, logged, emailed or returned.
//
// Deploy: supabase functions deploy create-servant-user   (verify_jwt stays ON)

import {
  adminClient, authenticate, serveJson, HttpError, isAdmin, isServiceHead, managedGrades,
  cleanName, cleanEmail, cleanGender, cleanGrade, cleanGrades, assignmentFor, snapshot,
  writeAudit, cleanPassword,
  ROLE_SERVANT, ROLE_SERVICE_HEAD, PROFILE_COLUMNS,
} from '../_shared/common.ts';

serveJson(async (req, body) => {
  const caller = await authenticate(req);
  if (!isAdmin(caller) && !isServiceHead(caller)) {
    throw new HttpError(403, 'غير مسموح — دورك لا يتيح إنشاء مستخدمين');
  }

  const fullName = cleanName(body.full_name);
  const email    = cleanEmail(body.email);
  const password = cleanPassword(body.password, email);
  const role     = typeof body.role === 'string' && body.role ? body.role : ROLE_SERVANT;
  const phone    = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim().slice(0, 30) : null;

  // ── Authorization (decided from the caller's DB record only) ──────────────
  let gender: string;
  let grades: string[];
  if (isAdmin(caller)) {
    if (role !== ROLE_SERVANT && role !== ROLE_SERVICE_HEAD) {
      throw new HttpError(403, 'غير مسموح — يمكن إنشاء خادم أو أمين خدمة فقط');
    }
    gender = cleanGender(body.assigned_gender);
    grades = role === ROLE_SERVICE_HEAD
      ? cleanGrades(body.assigned_grades ?? (body.assigned_grade ? [body.assigned_grade] : []))
      : [cleanGrade(body.assigned_grade)];
  } else {
    if (role !== ROLE_SERVANT) throw new HttpError(403, 'غير مسموح — أمين الخدمة يمكنه إنشاء خدام فقط');
    const grade = cleanGrade(body.assigned_grade);
    if (!managedGrades(caller).includes(grade)) {
      throw new HttpError(403, 'غير مسموح — المرحلة المختارة خارج نطاق إشرافك');
    }
    gender = cleanGender(body.assigned_gender ?? caller.assigned_gender);
    if (!caller.assigned_gender || gender !== caller.assigned_gender) {
      throw new HttpError(403, 'غير مسموح — النوع المختار خارج نطاق إشرافك');
    }
    grades = [grade];
  }

  // ── Duplicate checks ──────────────────────────────────────────────────────
  const { data: dup } = await adminClient.from('profiles').select('id').ilike('email', email).limit(1);
  if (dup && dup.length) throw new HttpError(409, 'هذا البريد الإلكتروني مسجّل مسبقاً في النظام.');

  // ── Create the Auth account (email_confirm kept true, as before) ──────────
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created?.user) {
    if (/already (been )?registered|already exists/i.test(createErr?.message ?? '')) {
      throw new HttpError(409, 'هذا البريد الإلكتروني مسجّل مسبقاً في النظام.');
    }
    console.error('[create-servant-user] createUser failed:', createErr?.message);
    throw new HttpError(500, 'تعذّر إنشاء الحساب');
  }
  const newId = created.user.id;

  // ── Profile (the on_auth_user_created trigger already inserted a stub row) ─
  const profileRow = {
    id: newId, full_name: fullName, email, role, assigned_gender: gender,
    ...assignmentFor(role, grades), phone, status: 'نشط',
  };
  try {
    const { data: profile, error: pErr } = await adminClient
      .from('profiles').upsert(profileRow, { onConflict: 'id' }).select(PROFILE_COLUMNS).single();
    if (pErr || !profile) throw new Error(pErr?.message ?? 'profile upsert returned nothing');

    await writeAudit(caller.id, newId, 'create', null, snapshot(profile));

    return { success: true, id: newId, email, full_name: fullName, role, data: profile };
  } catch (e) {
    // Roll back: deleting the auth user cascades to profiles (FK ON DELETE CASCADE).
    const { error: delErr } = await adminClient.auth.admin.deleteUser(newId);
    console.error('[create-servant-user] rolled back', newId, (e as Error).message, delErr?.message ?? '');
    throw new HttpError(500, 'فشل إنشاء الملف الشخصي — تم التراجع عن إنشاء الحساب');
  }
});
