import { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2, MapPin } from 'lucide-react';
import LocationPickerModal from '../components/LocationPickerModal';
import { GRADES } from '../data/constants';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callFn(payload) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/public-update-student-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON}`,
      apikey: SUPABASE_ANON,
    },
    body: JSON.stringify(payload),
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return data || { success: false, message: 'حدث خطأ، حاول مرة أخرى' };
}

const ARROW = `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

const IS = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
  fontFamily: 'Cairo, sans-serif', fontSize: '16px', color: '#374151', direction: 'rtl',
  outline: 'none', background: 'white', boxSizing: 'border-box', minHeight: '48px',
  maxWidth: '100%', WebkitAppearance: 'none', appearance: 'none',
};

const SEL = { ...IS, backgroundImage: ARROW, backgroundRepeat: 'no-repeat', backgroundPosition: 'left 12px center', paddingLeft: '32px' };

// Always empty — old stored data is never prefilled.
const EMPTY_FORM = {
  name: '', birth_date: '', gender: '', grade: '', school: '', mother_name: '',
  parent_phone: '', student_phone: '', address: '',   notes: '', hobbies: '',
};

function Field({ label, required, error, children }) {
  return (
    <div style={{ marginBottom: '14px', textAlign: 'right' }} data-has-error={!!error}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
        {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '6px' }}>{error}</p>}
    </div>
  );
}

function ErrorBox({ children }) {
  return (
    <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
      <p style={{ fontSize: '13px', color: '#991B1B', textAlign: 'right' }}>{children}</p>
      <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0 }} />
    </div>
  );
}

export default function PublicUpdateDataPage() {
  const [students, setStudents] = useState([]);
  const [listError, setListError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [phone, setPhone] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verified, setVerified] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState({});
  const [mapOpen, setMapOpen] = useState(false);
  // Only ever set by the user in this session; old saved location is never loaded.
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    callFn({ action: 'list_students' }).then(res => {
      if (res.success) setStudents(res.students || []);
      else setListError('تعذّر تحميل قائمة المخدومين');
    });
  }, []);

  async function handleVerify(e) {
    e.preventDefault();
    if (!studentId || !phone.trim()) return;
    setVerifying(true);
    setVerifyError('');
    const res = await callFn({ action: 'verify_student', student_id: studentId, phone_number: phone });
    setVerifying(false);
    if (res.success) {
      setVerified(true);
      setForm(EMPTY_FORM);
      setSelectedLocation(null);
    } else {
      setVerified(false);
      setVerifyError(res.message === 'الرقم غير مطابق للبيانات المسجلة'
        ? 'الرقم غير مطابق للبيانات المسجلة. من فضلك راجع الخادم المسؤول.'
        : (res.message || 'حدث خطأ، حاول مرة أخرى'));
    }
  }

  const MOBILE = /^01[0-9]{9}$/;
  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'الاسم بالكامل مطلوب';
    if (!form.grade) e.grade = 'المرحلة الدراسية مطلوبة';
    if (!form.gender) e.gender = 'النوع مطلوب';
    if (!form.address.trim()) e.address = 'العنوان التفصيلي مطلوب';
    const pp = form.parent_phone.replace(/[\s\-()]/g, '');
    if (!pp) e.parent_phone = 'رقم موبايل ولي الأمر مطلوب';
    else if (!MOBILE.test(pp)) e.parent_phone = 'رقم غير صحيح (مثال: 01xxxxxxxxx)';
    const sp = form.student_phone.replace(/[\s\-()]/g, '');
    if (sp && !MOBILE.test(sp)) e.student_phone = 'رقم غير صحيح (مثال: 01xxxxxxxxx)';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      setSubmitError('');
      setTimeout(() => document.querySelector('[data-has-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
      return;
    }
    setSaving(true);
    setSubmitError('');
    const { latitude, longitude } = selectedLocation || {};
    const data = {
      name: form.name, birth_date: form.birth_date, gender: form.gender, grade: form.grade,
      school: form.school, mother_name: form.mother_name,
      parent_phone: form.parent_phone, student_phone: form.student_phone,
      address: form.address,
      latitude: latitude ?? null, longitude: longitude ?? null,
      location_updated_at: selectedLocation ? new Date().toISOString() : null,
      notes: form.notes, hobbies: form.hobbies,
    };
    console.log('[update-data] submit payload →', { student_id: studentId, data });
    const res = await callFn({
      action: 'submit_update', student_id: studentId, verification_phone: phone, data,
    });
    console.log('[update-data] submit response →', res);
    setSaving(false);
    if (res.success) {
      if (res.ignored_fields?.length) console.warn('[update-data] fields not saved:', res.ignored_fields);
      setDone(true);
    } else {
      if (res.field_errors) setErrors(res.field_errors);
      setSubmitError(res.message || 'تعذّر حفظ البيانات');
    }
  }

  const set = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setErrors(p => (p[k] ? { ...p, [k]: '' } : p)); };
  const input = (k, props = {}) => <input style={IS} value={form[k]} onChange={set(k)} {...props} />;

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: '#F9FAFB', fontFamily: 'Cairo, sans-serif', padding: 'max(16px, env(safe-area-inset-top)) 12px max(24px, env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: 'clamp(16px, 5vw, 24px)', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle2 size={48} color="#16A34A" />
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginTop: '12px' }}>تم تحديث البيانات بنجاح، شكرًا لتعاونكم</h2>
          </div>
        ) : !verified ? (
          <form onSubmit={handleVerify}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <ShieldCheck size={22} color="#8B1A1A" />
              <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>تأكيد الهوية</h1>
            </div>
            {listError && <ErrorBox>{listError}</ErrorBox>}
            {verifyError && <ErrorBox>{verifyError}</ErrorBox>}
            <Field label="اختر اسم المخدوم">
              <select style={SEL} value={studentId} onChange={e => { setStudentId(e.target.value); setVerifyError(''); }} required>
                <option value="">— اختر —</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}{s.grade ? ` — ${s.grade}` : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="رقم موبايل مسجل لدينا">
              <input style={{ ...IS, direction: 'ltr', textAlign: 'right' }} type="tel" inputMode="tel" value={phone}
                onChange={e => { setPhone(e.target.value); setVerifyError(''); }} placeholder="01xxxxxxxxx" required />
              <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>
                اكتب رقم موبايل المخدوم أو ولي الأمر المسجل لدينا للتأكد من الهوية
              </p>
            </Field>
            <button type="submit" disabled={verifying || !studentId || !phone.trim()} style={{
              width: '100%', padding: '14px', minHeight: '50px', border: 'none', borderRadius: '10px', background: '#8B1A1A', color: 'white',
              fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              opacity: (verifying || !studentId || !phone.trim()) ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              {verifying && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              متابعة
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginBottom: '16px' }}>تحديث بيانات المخدوم</h1>
            {submitError && <ErrorBox>{submitError}</ErrorBox>}
            <Field label="الاسم بالكامل" required error={errors.name}>{input('name')}</Field>
            <Field label="تاريخ الميلاد">{input('birth_date', { type: 'date' })}</Field>
            <Field label="النوع" required error={errors.gender}>
              <select style={SEL} value={form.gender} onChange={set('gender')}>
                <option value="">— اختر —</option>
                <option value="ذكر">ذكر</option>
                <option value="أنثى">أنثى</option>
              </select>
            </Field>
            <Field label="المرحلة الدراسية" required error={errors.grade}>
              <select style={SEL} value={form.grade} onChange={set('grade')}>
                <option value="">— اختر —</option>
                {GRADES.filter(g => g.id).map(g => <option key={g.id} value={g.label}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="المدرسة">{input('school')}</Field>
            <Field label="اسم الأم">{input('mother_name')}</Field>
            <Field label="رقم موبايل ولي الأمر" required error={errors.parent_phone}>{input('parent_phone', { type: 'tel', inputMode: 'tel', style: { ...IS, direction: 'ltr', textAlign: 'right' } })}</Field>
            <Field label="رقم موبايل المخدوم (اختياري)" error={errors.student_phone}>
              {input('student_phone', { type: 'tel', inputMode: 'tel', style: { ...IS, direction: 'ltr', textAlign: 'right' } })}
              <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>اكتب رقم المخدوم الشخصي إن وجد</p>
            </Field>
            <Field label="العنوان التفصيلي" required error={errors.address}>
              {input('address', { placeholder: 'مثال: شارع، رقم العمارة، الدور، علامة مميزة...' })}
            </Field>
            <Field label="موقع البيت على الخريطة">
              <div style={{ border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setMapOpen(true)} style={{
                  padding: '10px 14px', minHeight: '44px', border: '1.5px solid #8B1A1A', borderRadius: '8px', background: 'white', color: '#8B1A1A',
                  fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>{selectedLocation ? 'تعديل الموقع' : 'تحديد الموقع على الخريطة'}</button>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: selectedLocation ? '#16A34A' : '#6B7280' }}>
                  {selectedLocation ? 'تم تحديد الموقع على الخريطة' : 'لم يتم تحديد الموقع بعد'}
                  <MapPin size={16} color={selectedLocation ? '#16A34A' : '#9CA3AF'} />
                </span>
              </div>
            </Field>
            <Field label="ملاحظات">
              <textarea style={{ ...IS, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={set('notes')} />
            </Field>
            <Field label="المواهب والاهتمامات">{input('hobbies', { placeholder: 'افصل بينها بفاصلة' })}</Field>
            <button type="submit" disabled={saving} style={{
              width: '100%', padding: '14px', minHeight: '50px', border: 'none', borderRadius: '10px', background: '#8B1A1A', color: 'white',
              fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              حفظ البيانات
            </button>
          </form>
        )}
      </div>
      {/* No initialLat/initialLng: old saved location is never shown */}
      <LocationPickerModal
        isOpen={mapOpen}
        onClose={() => setMapOpen(false)}
        initialLat={selectedLocation?.latitude ?? null}
        initialLng={selectedLocation?.longitude ?? null}
        studentName="موقع البيت"
        onSave={async (lat, lng) => { setSelectedLocation({ latitude: lat, longitude: lng }); }}
      />
    </div>
  );
}
