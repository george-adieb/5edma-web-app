import { useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react';
import { GRADES } from '../../data/constants';
import {
  ROLE_LABELS, ROLE_BADGE, GENDER_OPTIONS, genderLabel, gradesOf, gradeText,
  createUser, updateUser, resetPassword, deleteUser, deactivateUser, reactivateUser, isInactive, passwordError,
} from '../../lib/userManagement';

const ALL_GRADES = GRADES.filter(g => g.id).map(g => g.label);

const fieldStyle = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
  fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#374151', direction: 'rtl',
  outline: 'none', background: 'white', boxSizing: 'border-box', minHeight: '42px',
};

export function RoleBadge({ role }) {
  const s = ROLE_BADGE[role] || { bg: '#F3F4F6', color: '#6B7280' };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px', whiteSpace: 'nowrap' }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px', textAlign: 'right' }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: '11.5px', color: '#9CA3AF', marginTop: '4px', textAlign: 'right' }}>{hint}</p>}
    </div>
  );
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div role="dialog" aria-modal="true" style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '520px', maxHeight: '92dvh', display: 'flex', flexDirection: 'column', direction: 'rtl', fontFamily: 'Cairo, sans-serif', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" style={{ background: '#F3F4F6', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '18px 20px', overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '14px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>{footer}</div>}
      </div>
    </div>
  );
}

const PrimaryBtn = ({ children, ...p }) => (
  <button {...p} style={{ padding: '10px 20px', borderRadius: '9px', border: 'none', background: p.disabled ? '#D1A5A5' : '#8B1A1A', color: 'white', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', cursor: p.disabled ? 'not-allowed' : 'pointer', minHeight: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}>{children}</button>
);
const GhostBtn = ({ children, ...p }) => (
  <button {...p} style={{ padding: '10px 18px', borderRadius: '9px', border: '1.5px solid #E5E7EB', background: 'white', color: '#6B7280', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', minHeight: '42px' }}>{children}</button>
);

function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      <p style={{ fontSize: '13px', color: '#991B1B', margin: 0, textAlign: 'right' }}>{msg}</p>
      <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input style={{ ...fieldStyle, direction: 'ltr', textAlign: 'right', paddingLeft: '40px' }} type={show ? 'text' : 'password'}
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="new-password" maxLength={72} />
      <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '6px', display: 'flex' }}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

function GenderPicker({ value, onChange, locked }) {
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      {GENDER_OPTIONS.map(o => {
        const on = value === o.value;
        return (
          <button key={o.value} type="button" disabled={locked && !on} onClick={() => !locked && onChange(o.value)}
            style={{ flex: 1, padding: '8px', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', minHeight: '42px',
              cursor: locked ? 'default' : 'pointer', opacity: locked && !on ? 0.4 : 1,
              border: `2px solid ${on ? '#8B1A1A' : '#E5E7EB'}`, background: on ? '#8B1A1A' : 'white', color: on ? 'white' : '#6B7280' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function GradeMulti({ options, value, onChange }) {
  const toggle = (g) => onChange(value.includes(g) ? value.filter(x => x !== g) : [...value, g]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map(g => {
        const on = value.includes(g);
        return (
          <button key={g} type="button" onClick={() => toggle(g)}
            style={{ padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12.5px', border: `1.5px solid ${on ? '#8B1A1A' : '#E5E7EB'}`, background: on ? '#8B1A1A' : 'white', color: on ? 'white' : '#6B7280' }}>{g}</button>
        );
      })}
    </div>
  );
}

function GradeSelect({ options, value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={fieldStyle}>
      <option value="">اختر المرحلة</option>
      {options.map(g => <option key={g} value={g}>{g}</option>)}
    </select>
  );
}

// ── Add user ─────────────────────────────────────────────────────────────────
// mode 'admin'  → choose Servant / Service Leader
// mode 'leader' → Servant only; grades and gender limited to the leader's own scope
export function AddUserModal({ mode, leader, onClose, onCreated }) {
  const isLeader = mode === 'leader';
  const leaderGrades = isLeader
    ? (leader?.assigned_grades?.length ? leader.assigned_grades : (leader?.assigned_grade ? [leader.assigned_grade] : []))
    : [];
  const gradeOptions = isLeader ? leaderGrades : ALL_GRADES;
  const lockedGender = isLeader ? (leader?.assigned_gender || '') : '';

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm: '', role: 'SERVANT',
    grade: isLeader && leaderGrades.length === 1 ? leaderGrades[0] : '',
    grades: [], gender: lockedGender,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const asLeaderRole = form.role === 'SERVICE_HEAD';

  function validate() {
    if (form.full_name.trim().length < 2) return 'الاسم بالكامل مطلوب';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'البريد الإلكتروني غير صحيح';
    if (!form.password) return 'كلمة المرور مطلوبة';
    if (!form.confirm) return 'يرجى تأكيد كلمة المرور';
    const pe = passwordError(form.password, form.confirm); if (pe) return pe;
    if (asLeaderRole ? form.grades.length === 0 : !form.grade) return 'يرجى اختيار المرحلة الدراسية';
    if (!form.gender) return 'يرجى اختيار بنين أو بنات';
    return '';
  }

  async function submit() {
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true); setError('');
    try {
      const res = await createUser({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: isLeader ? 'SERVANT' : form.role,
        assigned_gender: form.gender,
        ...(asLeaderRole ? { assigned_grades: form.grades } : { assigned_grade: form.grade }),
      });
      setForm(p => ({ ...p, password: '', confirm: '' }));
      setDone(res);
      onCreated?.(res);
    } catch (e) {
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { setSaving(false); }
  }

  if (done) {
    return (
      <Modal title={isLeader ? 'إضافة خادم' : 'إضافة مستخدم'} onClose={onClose} footer={<PrimaryBtn onClick={onClose}>تم</PrimaryBtn>}>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <CheckCircle2 size={44} color="#16A34A" />
          <p style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: '10px 0 4px' }}>تم إنشاء الحساب</p>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>{done.full_name} — {done.email}</p>
          <p style={{ fontSize: '12.5px', marginTop: '12px', color: '#6B7280', lineHeight: 1.7 }}>يمكنه تسجيل الدخول الآن بالبريد وكلمة المرور التي حددتها.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={isLeader ? 'إضافة خادم' : 'إضافة مستخدم'} onClose={onClose}
      footer={<>
        <PrimaryBtn onClick={submit} disabled={saving}>{saving && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}إنشاء الحساب</PrimaryBtn>
        <GhostBtn onClick={onClose}>إلغاء</GhostBtn>
      </>}>
      <ErrorBox msg={error} />
      <Field label="الاسم بالكامل">
        <input style={fieldStyle} value={form.full_name} onChange={e => set('full_name', e.target.value)} maxLength={120} />
      </Field>
      <Field label="البريد الإلكتروني">
        <input style={{ ...fieldStyle, direction: 'ltr', textAlign: 'right' }} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
      </Field>
      <Field label="كلمة المرور" hint="٨ أحرف على الأقل، وتحتوي على حروف وأرقام.">
        <PasswordInput value={form.password} onChange={v => set('password', v)} />
      </Field>
      <Field label="تأكيد كلمة المرور">
        <PasswordInput value={form.confirm} onChange={v => set('confirm', v)} />
      </Field>
      {!isLeader && (
        <Field label="الدور">
          <select style={fieldStyle} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value, grade: '', grades: [] }))}>
            <option value="SERVANT">خادم</option>
            <option value="SERVICE_HEAD">أمين خدمة</option>
          </select>
        </Field>
      )}
      <Field label={asLeaderRole ? 'المراحل الدراسية (يمكن اختيار أكثر من مرحلة)' : 'المرحلة الدراسية'}>
        {asLeaderRole
          ? <GradeMulti options={gradeOptions} value={form.grades} onChange={v => set('grades', v)} />
          : <GradeSelect options={gradeOptions} value={form.grade} onChange={v => set('grade', v)} />}
      </Field>
      <Field label="النوع" hint={lockedGender ? 'مقيّد بنطاق خدمتك.' : undefined}>
        <GenderPicker value={form.gender} onChange={v => set('gender', v)} locked={!!lockedGender} />
      </Field>
    </Modal>
  );
}

function ResetPasswordSection({ userId }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ ok: '', err: '' });
  async function submit() {
    const e = passwordError(pw, pw2);
    if (e) { setMsg({ ok: '', err: e }); return; }
    setBusy(true); setMsg({ ok: '', err: '' });
    try { await resetPassword(userId, pw); setMsg({ ok: 'تم تعيين كلمة المرور الجديدة.', err: '' }); setPw(''); setPw2(''); setOpen(false); }
    catch (err) { setMsg({ ok: '', err: err.message }); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ border: '1px solid #F3F4F6', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px' }}>
      {msg.ok && <p style={{ color: '#15803D', fontSize: '12.5px', margin: '0 0 8px', textAlign: 'right' }}>{msg.ok}</p>}
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setMsg({ ok: '', err: '' }); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#8B1A1A', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', padding: 0 }}>
          <KeyRound size={15} /> إعادة تعيين كلمة المرور
        </button>
      ) : (
        <>
          <ErrorBox msg={msg.err} />
          <Field label="كلمة المرور الجديدة"><PasswordInput value={pw} onChange={setPw} /></Field>
          <Field label="تأكيد كلمة المرور"><PasswordInput value={pw2} onChange={setPw2} /></Field>
          <div style={{ display: 'flex', gap: '8px' }}>
            <PrimaryBtn type="button" onClick={submit} disabled={busy}>{busy && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}تعيين كلمة المرور</PrimaryBtn>
            <GhostBtn type="button" onClick={() => { setOpen(false); setPw(''); setPw2(''); }}>إلغاء</GhostBtn>
          </div>
        </>
      )}
    </div>
  );
}

// ── Edit user (admin only) ───────────────────────────────────────────────────
function ReactivateSection({ user, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function run() {
    setBusy(true); setErr('');
    try { await reactivateUser(user.id); onDone?.(); } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <div style={{ border: '1px solid #BBF7D0', background: '#F0FDF4', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px' }}>
      <ErrorBox msg={err} />
      <p style={{ fontSize: '12.5px', color: '#166534', margin: '0 0 8px', textAlign: 'right' }}>هذا الحساب غير نشط ولا يمكنه تسجيل الدخول.</p>
      <PrimaryBtn type="button" onClick={run} disabled={busy}>{busy ? 'جارٍ التفعيل...' : 'إعادة تفعيل الحساب'}</PrimaryBtn>
    </div>
  );
}

function DeleteSection({ user, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function run() {
    setBusy(true); setErr('');
    try { await deleteUser(user.id); onDeleted?.(); }
    catch (e) { setErr(e.message || 'تعذّر الحذف'); setBusy(false); }
  }
  return (
    <div style={{ border: '1px solid #FECACA', background: '#FFF5F5', borderRadius: '10px', padding: '10px 14px', marginTop: '6px' }}>
      <ErrorBox msg={err} />
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', padding: 0 }}>
          <Trash2 size={15} /> حذف المستخدم
        </button>
      ) : (
        <>
          <p style={{ fontSize: '12.5px', color: '#991B1B', margin: '0 0 10px', textAlign: 'right', lineHeight: 1.8 }}>
            سيتم حذف حساب «{user.full_name}» نهائياً (حذف نهائي للمدير فقط) ولن يستطيع تسجيل الدخول. سجلات الحضور والمخدومين تبقى كما هي. لا يمكن التراجع.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={run} disabled={busy} style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', background: '#DC2626', color: 'white', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', minHeight: '40px' }}>{busy ? 'جارٍ الحذف...' : 'تأكيد الحذف'}</button>
            <GhostBtn type="button" onClick={() => setConfirming(false)}>تراجع</GhostBtn>
          </div>
        </>
      )}
    </div>
  );
}

export function EditUserModal({ user, currentUserId, onClose, onSaved }) {
  const isAdminTarget = user.role === 'ADMIN' || user.role === 'GENERAL_SECRETARIAT';
  const isSelf = user.id === currentUserId;
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    role: user.role,
    grade: user.role === 'SERVANT' ? (user.assigned_grade || '') : (gradesOf(user)[0] || ''),
    grades: gradesOf(user),
    gender: user.assigned_gender || '',
    email: user.email || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const asLeaderRole = form.role === 'SERVICE_HEAD';
  const roleChanged = form.role !== user.role;

  function onRoleChange(role) {
    // Carry the current grades over to the new role's shape.
    setForm(p => ({ ...p, role, grade: p.grade || p.grades[0] || '', grades: p.grades.length ? p.grades : (p.grade ? [p.grade] : []) }));
  }

  async function save() {
    setError('');
    if (form.full_name.trim().length < 2) { setError('الاسم بالكامل مطلوب'); return; }
    const changes = {};
    if (form.full_name.trim() !== (user.full_name || '')) changes.full_name = form.full_name.trim();
    if (form.email.trim().toLowerCase() !== (user.email || '').toLowerCase()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError('البريد الإلكتروني غير صحيح'); return; }
      changes.email = form.email.trim();
    }
    if (!isAdminTarget) {
      if (asLeaderRole ? form.grades.length === 0 : !form.grade) { setError('يرجى اختيار المرحلة الدراسية'); return; }
      if (!form.gender) { setError('يرجى اختيار بنين أو بنات'); return; }
      if (roleChanged) changes.role = form.role;
      const gradesNow = asLeaderRole ? form.grades : [form.grade];
      const gradesBefore = gradesOf(user);
      if (roleChanged || JSON.stringify([...gradesNow].sort()) !== JSON.stringify([...gradesBefore].sort())) {
        if (asLeaderRole) changes.assigned_grades = form.grades; else changes.assigned_grade = form.grade;
      }
      if (form.gender !== (user.assigned_gender || '')) changes.assigned_gender = form.gender;
    }
    if (!Object.keys(changes).length) { onClose(); return; }
    setSaving(true);
    try {
      const res = await updateUser(user.id, changes);
      onSaved?.(res.user);
    } catch (e) {
      setError(e.message || 'تعذّر حفظ التغييرات');
    } finally { setSaving(false); }
  }

  return (
    <Modal title={`تعديل: ${user.full_name || ''}`} onClose={onClose}
      footer={<>
        <PrimaryBtn onClick={save} disabled={saving}>{saving && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}حفظ التغييرات</PrimaryBtn>
        <GhostBtn onClick={onClose}>إلغاء</GhostBtn>
      </>}>
      <ErrorBox msg={error} />
      <div style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '12.5px', color: '#6B7280', textAlign: 'right', lineHeight: 1.9 }}>
        <div>الدور الحالي: <RoleBadge role={user.role} /></div>
        <div>المرحلة الحالية: <strong style={{ color: '#374151' }}>{gradeText(user)}</strong> — النوع: <strong style={{ color: '#374151' }}>{genderLabel(user.assigned_gender)}</strong></div>
      </div>
      <Field label="الاسم بالكامل">
        <input style={fieldStyle} value={form.full_name} onChange={e => set('full_name', e.target.value)} maxLength={120} />
      </Field>
      <Field label="البريد الإلكتروني">
        <input style={{ ...fieldStyle, direction: 'ltr', textAlign: 'right' }} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
      </Field>
      {!isSelf && <ResetPasswordSection userId={user.id} />}
      {isAdminTarget ? (
        <p style={{ fontSize: '12.5px', color: '#92400E', background: '#FEF3C7', borderRadius: '8px', padding: '10px 12px', textAlign: 'right' }}>
          {isSelf ? 'لا يمكنك تغيير دورك أو نطاقك بنفسك.' : 'حسابات المدير محمية: يمكن تعديل الاسم فقط.'}
        </p>
      ) : (
        <>
          <Field label="الدور">
            <select style={fieldStyle} value={form.role} onChange={e => onRoleChange(e.target.value)}>
              <option value="SERVANT">خادم</option>
              <option value="SERVICE_HEAD">أمين خدمة</option>
            </select>
          </Field>
          {roleChanged && (
            <p style={{ fontSize: '12.5px', color: '#92400E', background: '#FEF3C7', borderRadius: '8px', padding: '10px 12px', textAlign: 'right', marginBottom: '14px' }}>
              سيتم تغيير الدور من «{ROLE_LABELS[user.role]}» إلى «{ROLE_LABELS[form.role]}» وسيسري فوراً. لا تتغير بيانات المخدومين أو سجلات الحضور السابقة.
            </p>
          )}
          <Field label={asLeaderRole ? 'المراحل الدراسية' : 'المرحلة الدراسية'}>
            {asLeaderRole
              ? <GradeMulti options={ALL_GRADES} value={form.grades} onChange={v => set('grades', v)} />
              : <GradeSelect options={ALL_GRADES} value={form.grade} onChange={v => set('grade', v)} />}
          </Field>
          <Field label="النوع">
            <GenderPicker value={form.gender} onChange={v => set('gender', v)} />
          </Field>
        </>
      )}
      {!isSelf && !isAdminTarget && isInactive(user) && <ReactivateSection user={user} onDone={() => onSaved?.()} />}
      {!isSelf && !isAdminTarget && <DeleteSection user={user} onDeleted={() => onSaved?.()} />}
    </Modal>
  );
}

// ── Details ──────────────────────────────────────────────────────────────────
export function UserDetailsModal({ user, onClose }) {
  const rows = [
    ['الاسم', user.full_name || '—'],
    ['البريد الإلكتروني', user.email || '—'],
    ['الدور', <RoleBadge key="r" role={user.role} />],
    ['المرحلة الدراسية', gradeText(user)],
    ['النوع', genderLabel(user.assigned_gender)],
    ['تاريخ الإضافة', user.created_at ? new Date(user.created_at).toLocaleDateString('ar-EG') : '—'],
  ];
  return (
    <Modal title="تفاصيل المستخدم" onClose={onClose}
      footer={<GhostBtn onClick={onClose}>إغلاق</GhostBtn>}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderBottom: '1px solid #F9FAFB', fontSize: '13px' }}>
          <span style={{ color: '#9CA3AF', fontWeight: 700 }}>{k}</span>
          <span style={{ color: '#111827', fontWeight: 600, textAlign: 'left', direction: k === 'البريد الإلكتروني' ? 'ltr' : 'rtl' }}>{v}</span>
        </div>
      ))}
    </Modal>
  );
}

// ── Service leader: edit one of their own servants ────────────────────────────
export function LeaderEditServantModal({ servant, leader, onClose, onSaved }) {
  const leaderGrades = gradesOf(leader);
  const [form, setForm] = useState({
    full_name: servant.full_name || '', email: servant.email || '', grade: servant.assigned_grade || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    setError('');
    if (form.full_name.trim().length < 2) { setError('الاسم بالكامل مطلوب'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError('البريد الإلكتروني غير صحيح'); return; }
    if (!form.grade) { setError('يرجى اختيار المرحلة الدراسية'); return; }
    const changes = {};
    if (form.full_name.trim() !== (servant.full_name || '')) changes.full_name = form.full_name.trim();
    if (form.email.trim().toLowerCase() !== (servant.email || '').toLowerCase()) changes.email = form.email.trim();
    if (form.grade !== servant.assigned_grade) changes.assigned_grade = form.grade;
    if (!Object.keys(changes).length) { onClose(); return; }
    setSaving(true);
    try { await updateUser(servant.id, changes); onSaved?.(); }
    catch (e) { setError(e.message || 'تعذّر حفظ التغييرات'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`تعديل الخادم: ${servant.full_name || ''}`} onClose={onClose}
      footer={<>
        <PrimaryBtn onClick={save} disabled={saving}>{saving && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}حفظ التغييرات</PrimaryBtn>
        <GhostBtn onClick={onClose}>إلغاء</GhostBtn>
      </>}>
      <ErrorBox msg={error} />
      <Field label="الاسم بالكامل"><input style={fieldStyle} value={form.full_name} onChange={e => set('full_name', e.target.value)} maxLength={120} /></Field>
      <Field label="البريد الإلكتروني"><input style={{ ...fieldStyle, direction: 'ltr', textAlign: 'right' }} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
      <Field label="المرحلة الدراسية" hint="يمكن اختيار المراحل التي تشرف عليها فقط."><GradeSelect options={leaderGrades} value={form.grade} onChange={v => set('grade', v)} /></Field>
      <Field label="النوع" hint="مقيّد بنطاق خدمتك."><GenderPicker value={servant.assigned_gender} onChange={() => {}} locked /></Field>
      <ResetPasswordSection userId={servant.id} />
    </Modal>
  );
}

// ── Service leader: "حذف الخادم" (soft delete = deactivate) ───────────────────
export function DeactivateServantModal({ servant, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function run() {
    setBusy(true); setErr('');
    try { await deactivateUser(servant.id); onDone?.(); }
    catch (e) { setErr(e.message || 'تعذّر الحذف'); setBusy(false); }
  }
  return (
    <Modal title="حذف الخادم" onClose={onClose}
      footer={<>
        <button type="button" onClick={run} disabled={busy} style={{ padding: '10px 20px', borderRadius: '9px', border: 'none', background: '#DC2626', color: 'white', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', minHeight: '42px' }}>{busy ? 'جارٍ الحذف...' : 'نعم، احذف'}</button>
        <GhostBtn onClick={onClose}>تراجع</GhostBtn>
      </>}>
      <ErrorBox msg={err} />
      <p style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: '0 0 8px', textAlign: 'right' }}>هل أنت متأكد من حذف هذا الخادم؟</p>
      <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 6px', textAlign: 'right' }}>«{servant.full_name}» — {servant.email}</p>
      <ul style={{ fontSize: '12.5px', color: '#6B7280', lineHeight: 1.9, paddingInlineStart: '18px', margin: 0, textAlign: 'right' }}>
        <li>سيتم إيقاف الحساب فوراً ولن يستطيع الخادم تسجيل الدخول.</li>
        <li>سيختفي من قائمة خدام المرحلة.</li>
        <li>سجلات الحضور والافتقاد والنقاط والملاحظات الخاصة بالمخدومين تبقى كما هي.</li>
        <li>يمكن للمدير إعادة تفعيل الحساب لاحقاً.</li>
      </ul>
    </Modal>
  );
}
