// supabase/functions/manage-users/index.ts
//
// Body: { action, ... }
//   list            ADMIN → everyone; SERVICE_HEAD → active servants of the SAME GENDER who serve at least one
//                   of the leader's grades (each row flagged `manageable` when ALL its grades are the leader's).
//                   Never admins / general secretariat / other leaders.
//   update          ADMIN: name, email, role (SERVANT<->SERVICE_HEAD), grades, gender
//                   SERVICE_HEAD: name, email, grade (within own grades) of a servant they can manage
//   reset_password  ADMIN (any other account) | SERVICE_HEAD (a servant they can manage)
//   deactivate      ADMIN | SERVICE_HEAD (a servant they can manage)  – soft delete: no login, history kept
//   reactivate      ADMIN only
//   delete          ADMIN only – permanent removal of the account
//
// Authorization is decided here from the caller's and target's CURRENT database rows;
// nothing about roles/scope/leader is taken from the request.
//
// Deploy: supabase functions deploy manage-users   (verify_jwt stays ON)

import {
  adminClient, authenticate, serveJson, HttpError, isAdmin, isServiceHead, leaderManages, leaderSees,
  allGrades, managedGrades, isActive,
  cleanName, cleanEmail, cleanGender, cleanGrade, cleanGrades, cleanPassword, assignmentFor,
  snapshot, writeAudit, PROFILE_COLUMNS, MANAGEABLE_ROLES, ADMIN_LIKE_ROLES,
  ROLE_SERVANT, ROLE_SERVICE_HEAD, type Profile,
} from '../_shared/common.ts';

const FORBIDDEN = 'غير مسموح — المستخدم خارج نطاق صلاحياتك';

async function loadTarget(id: unknown): Promise<Profile> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'معرّف المستخدم غير صالح');
  const { data, error } = await adminClient.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
  if (error || !data) throw new HttpError(404, 'المستخدم غير موجود');
  return data as Profile;
}

async function lastSignInMap(): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.error('[manage-users] listUsers:', error.message); break; }
    data.users.forEach(u => map.set(u.id, u.last_sign_in_at ?? null));
    if (data.users.length < 1000) break;
  }
  return map;
}

/** Who the caller may act on: admin → any non-admin; leader → servants whose WHOLE scope is theirs. */
function assertCanManage(caller: Profile, target: Profile, opts: { allowLeaderTarget?: boolean } = {}) {
  if (isAdmin(caller)) {
    if (target.id === caller.id) throw new HttpError(403, 'لا يمكنك تنفيذ هذه العملية على حسابك');
    if (ADMIN_LIKE_ROLES.includes(target.role)) throw new HttpError(403, 'لا يمكن تعديل حساب المدير');
    if (!MANAGEABLE_ROLES.includes(target.role) && !opts.allowLeaderTarget) throw new HttpError(409, 'دور هذا الحساب غير مدعوم');
    return;
  }
  if (!leaderManages(caller, target)) throw new HttpError(403, FORBIDDEN);
}

async function setBan(id: string, banned: boolean) {
  const { error } = await adminClient.auth.admin.updateUserById(id, { ban_duration: banned ? '876000h' : 'none' });
  if (error) throw new Error(`ban update failed: ${error.message}`);
}

function classify(before: ReturnType<typeof snapshot>, after: ReturnType<typeof snapshot>): string[] {
  const actions: string[] = [];
  if (before.role !== after.role) actions.push('role_change');
  const key = (x: typeof before) => JSON.stringify([x.assigned_grade, x.assigned_grades, x.assigned_gender]);
  if (key(before) !== key(after)) actions.push('assignment_change');
  if (!actions.length) actions.push('profile_update');
  return actions;
}

async function restoreProfile(before: ReturnType<typeof snapshot>, id: string) {
  await adminClient.from('profiles').update({
    full_name: before.full_name, email: before.email, role: before.role, assigned_grade: before.assigned_grade,
    assigned_grades: before.assigned_grades, assigned_gender: before.assigned_gender,
    status: before.status,
  }).eq('id', id);
}

serveJson(async (req, body) => {
  const caller = await authenticate(req);
  if (!isAdmin(caller) && !isServiceHead(caller)) {
    throw new HttpError(403, 'غير مسموح — لا تملك صلاحية إدارة المستخدمين');
  }
  const admin = isAdmin(caller);

  // ── list ──────────────────────────────────────────────────────────────────
  if (body.action === 'list') {
    const { data, error } = await adminClient
      .from('profiles').select(PROFILE_COLUMNS).order('created_at', { ascending: false });
    if (error) throw new HttpError(500, 'تعذّر تحميل المستخدمين');
    let rows = (data ?? []) as Profile[];
    if (!admin) rows = rows.filter(p => leaderSees(caller, p));
    const signIns = await lastSignInMap();
    return {
      scope: admin ? 'all' : 'stage',
      users: rows.map(p => ({
        id: p.id, full_name: p.full_name, email: p.email, role: p.role, status: p.status,
        assigned_grade: p.assigned_grade, assigned_grades: p.assigned_grades, assigned_gender: p.assigned_gender,
        created_at: p.created_at, activated: !!signIns.get(p.id),
        manageable: admin ? true : leaderManages(caller, p),
      })),
    };
  }

  // ── reset_password ────────────────────────────────────────────────────────
  if (body.action === 'reset_password') {
    const target = await loadTarget(body.user_id);
    if (target.id === caller.id) throw new HttpError(403, 'لا يمكنك إعادة تعيين كلمة مرورك من هنا');
    assertCanManage(caller, target, { allowLeaderTarget: true });
    const password = cleanPassword(body.password, target.email ?? undefined);
    const { error } = await adminClient.auth.admin.updateUserById(target.id, { password });
    if (error) { console.error('[manage-users] reset_password failed:', error.message); throw new HttpError(500, 'تعذّر تعيين كلمة المرور'); }
    await writeAudit(caller.id, target.id, 'password_reset', null, null);
    return { success: true };
  }

  // ── deactivate (soft delete) ──────────────────────────────────────────────
  if (body.action === 'deactivate') {
    const target = await loadTarget(body.user_id);
    if (target.id === caller.id) throw new HttpError(403, 'لا يمكنك حذف حسابك');
    assertCanManage(caller, target, { allowLeaderTarget: true });
    if (!isActive(target)) throw new HttpError(409, 'الحساب غير نشط بالفعل');
    const before = snapshot(target);
    const { data: updated, error } = await adminClient.from('profiles')
      .update({ status: 'غير نشط' }).eq('id', target.id).select(PROFILE_COLUMNS).single();
    if (error || !updated) throw new HttpError(500, 'تعذّر تعطيل الحساب');
    try {
      await setBan(target.id, true);       // no new logins / token refresh
      await writeAudit(caller.id, target.id, 'deactivate', before, snapshot(updated));
    } catch (e) {
      await restoreProfile(before, target.id); await setBan(target.id, false).catch(() => {});
      console.error('[manage-users] deactivate rolled back:', (e as Error).message);
      throw new HttpError(500, 'تعذّر إكمال العملية — تم التراجع');
    }
    return { success: true };            // existing access tokens are cut off at once by RLS (status check)
  }

  // ── reactivate (ADMIN only) ───────────────────────────────────────────────
  if (body.action === 'reactivate') {
    if (!admin) throw new HttpError(403, 'غير مسموح — تفعيل الحسابات للمدير فقط');
    const target = await loadTarget(body.user_id);
    if (!MANAGEABLE_ROLES.includes(target.role)) throw new HttpError(403, 'لا يمكن تعديل هذا الحساب');
    if (isActive(target)) throw new HttpError(409, 'الحساب نشط بالفعل');
    const before = snapshot(target);
    const { data: updated, error } = await adminClient.from('profiles')
      .update({ status: 'نشط' }).eq('id', target.id).select(PROFILE_COLUMNS).single();
    if (error || !updated) throw new HttpError(500, 'تعذّر تفعيل الحساب');
    try {
      await setBan(target.id, false);
      await writeAudit(caller.id, target.id, 'reactivate', before, snapshot(updated));
    } catch (e) {
      await restoreProfile(before, target.id); await setBan(target.id, true).catch(() => {});
      console.error('[manage-users] reactivate rolled back:', (e as Error).message);
      throw new HttpError(500, 'تعذّر إكمال العملية — تم التراجع');
    }
    return { success: true };
  }

  // ── delete (ADMIN only, permanent) ────────────────────────────────────────
  if (body.action === 'delete') {
    if (!admin) throw new HttpError(403, 'غير مسموح — الحذف النهائي للمدير فقط');
    const target = await loadTarget(body.user_id);
    if (target.id === caller.id) throw new HttpError(403, 'لا يمكنك حذف حسابك');
    if (!MANAGEABLE_ROLES.includes(target.role)) throw new HttpError(403, 'لا يمكن حذف حساب المدير');

    // Audit first, so a deletion is never unrecorded; undo the entry if the delete fails.
    const { data: logRow, error: aErr } = await adminClient.from('user_audit_logs').insert({
      actor_id: caller.id, target_id: target.id, action: 'delete', previous_state: snapshot(target), new_state: null,
    }).select('id').single();
    if (aErr) { console.error('[manage-users] audit failed:', aErr.message); throw new HttpError(500, 'تعذّر تسجيل العملية في سجل المراجعة'); }

    // Deleting the auth user cascades to profiles; attendance/follow-up/points history keeps its rows (recorded_by → null).
    const { error: dErr } = await adminClient.auth.admin.deleteUser(target.id);
    if (dErr) {
      await adminClient.from('user_audit_logs').delete().eq('id', logRow.id);
      console.error('[manage-users] delete failed:', dErr.message);
      throw new HttpError(409, 'تعذّر حذف المستخدم — قد يكون مرتبطاً بسجلات (مثل ترحيل السنة الدراسية)');
    }
    return { success: true };
  }

  // ── update ────────────────────────────────────────────────────────────────
  if (body.action === 'update') {
    const target = await loadTarget(body.user_id);
    const patch: Record<string, unknown> = {};
    let newEmail: string | null = null;

    if (body.full_name !== undefined) patch.full_name = cleanName(body.full_name);
    if (body.email !== undefined) {
      const e = cleanEmail(body.email);
      if (e !== (target.email ?? '').toLowerCase()) newEmail = e;
    }

    if (!admin) {
      // ── service leader: a servant they manage, nothing else ──
      if (!leaderManages(caller, target)) throw new HttpError(403, FORBIDDEN);
      if (body.role !== undefined && body.role !== ROLE_SERVANT) throw new HttpError(403, 'غير مسموح — لا يمكن تغيير الدور');
      if (Array.isArray(body.assigned_grades) && body.assigned_grades.length > 1) throw new HttpError(403, 'غير مسموح — الخادم له مرحلة واحدة');
      const g = body.assigned_grade ?? (Array.isArray(body.assigned_grades) ? body.assigned_grades[0] : undefined);
      if (g !== undefined) {
        const grade = cleanGrade(g);
        if (!managedGrades(caller).includes(grade)) throw new HttpError(403, 'غير مسموح — المرحلة المختارة خارج نطاق إشرافك');
        if (grade !== target.assigned_grade || (target.assigned_grades?.length ?? 0) > 0) {
          Object.assign(patch, assignmentFor(ROLE_SERVANT, [grade]));
        }
      }
      if (body.assigned_gender !== undefined) {
        if (cleanGender(body.assigned_gender) !== caller.assigned_gender) throw new HttpError(403, 'غير مسموح — النوع المختار خارج نطاق إشرافك');
      }
    } else {
      // ── admin ──
      const touchesAccess = ['role', 'assigned_grade', 'assigned_grades', 'assigned_gender'].some(k => body[k] !== undefined);
      if (touchesAccess) {
        if (ADMIN_LIKE_ROLES.includes(target.role) || target.id === caller.id) throw new HttpError(403, 'لا يمكن تعديل دور أو نطاق حساب المدير');
        if (!MANAGEABLE_ROLES.includes(target.role)) throw new HttpError(409, 'دور هذا الحساب غير مدعوم للتعديل');
        const newRole = body.role !== undefined ? String(body.role) : target.role;
        if (!MANAGEABLE_ROLES.includes(newRole)) throw new HttpError(403, 'الدور المطلوب غير مسموح');

        const currentGrades = allGrades(target);
        let grades: string[];
        if (newRole === ROLE_SERVICE_HEAD) {
          const supplied = body.assigned_grades ?? (body.assigned_grade ? [body.assigned_grade] : undefined);
          grades = supplied !== undefined ? cleanGrades(supplied) : cleanGrades(currentGrades);
        } else {
          const supplied = body.assigned_grade ?? (Array.isArray(body.assigned_grades) && body.assigned_grades.length === 1 ? body.assigned_grades[0] : undefined);
          if (supplied !== undefined) grades = [cleanGrade(supplied)];
          else if (currentGrades.length === 1) grades = [currentGrades[0]];
          else throw new HttpError(400, 'يرجى تحديد مرحلة واحدة للخادم');
        }
        const gender = body.assigned_gender !== undefined ? cleanGender(body.assigned_gender) : target.assigned_gender;
        Object.assign(patch, { role: newRole }, assignmentFor(newRole, grades));
        if (body.assigned_gender !== undefined) patch.assigned_gender = gender;
      }
    }

    if (newEmail) {
      const { data: dup } = await adminClient.from('profiles').select('id').ilike('email', newEmail).neq('id', target.id).limit(1);
      if (dup && dup.length) throw new HttpError(409, 'هذا البريد الإلكتروني مسجّل مسبقاً في النظام.');
      patch.email = newEmail;
    }
    if (patch.full_name === target.full_name) delete patch.full_name;      // unchanged → not a change (no audit noise)
    if (Object.keys(patch).length === 0) throw new HttpError(400, 'لا توجد تغييرات للحفظ');

    const before = snapshot(target);
    if (newEmail) {
      const { error: eErr } = await adminClient.auth.admin.updateUserById(target.id, { email: newEmail, email_confirm: true });
      if (eErr) {
        if (/already|registered|exists/i.test(eErr.message)) throw new HttpError(409, 'هذا البريد الإلكتروني مسجّل مسبقاً في النظام.');
        console.error('[manage-users] email update failed:', eErr.message);
        throw new HttpError(500, 'تعذّر تغيير البريد الإلكتروني');
      }
    }
    const revertEmail = async () => {
      if (newEmail && before.email) await adminClient.auth.admin.updateUserById(target.id, { email: before.email, email_confirm: true });
    };

    const { data: updated, error: uErr } = await adminClient
      .from('profiles').update(patch).eq('id', target.id).select(PROFILE_COLUMNS).single();
    if (uErr || !updated) {
      await revertEmail();
      console.error('[manage-users] update failed:', uErr?.message);
      throw new HttpError(500, 'تعذّر حفظ التغييرات');
    }
    const after = snapshot(updated);

    try {
      for (const a of classify(before, after)) await writeAudit(caller.id, target.id, a, before, after);
    } catch (e) {
      // Never leave a privileged change un-audited: restore the previous values.
      await restoreProfile(before, target.id); await revertEmail();
      console.error('[manage-users] audit failed, reverted:', (e as Error).message);
      throw new HttpError(500, 'تعذّر تسجيل التغيير في سجل المراجعة — تم التراجع');
    }

    if (patch.full_name) {
      await adminClient.auth.admin.updateUserById(target.id, { user_metadata: { full_name: patch.full_name } });
    }
    return { success: true, user: updated };
  }

  throw new HttpError(400, 'عملية غير معروفة');
});
