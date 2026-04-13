import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Info, Save, MapPin, AlertCircle, Briefcase,
} from 'lucide-react';
import { insertServant } from '../lib/database';

/* ─── Shared sub-components (mirror of AddStudentPage) ───── */

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div style={{
      background: 'white', borderRadius: '14px', padding: '18px 20px',
      border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      marginBottom: '16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        justifyContent: 'flex-end', marginBottom: '18px',
        paddingBottom: '12px', borderBottom: '1.5px solid #F9FAFB',
      }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>{title}</h2>
        <div style={{
          width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
          background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#8B1A1A',
        }}>
          <Icon size={16} />
        </div>
      </div>
      {children}
    </div>
  );
}

function FormGroup({ label, optional, error, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', marginBottom: '6px' }}>
        {optional ? (
          <span style={{ fontSize: '10px', color: '#9CA3AF', background: '#F9FAFB', padding: '1px 6px', borderRadius: '4px', border: '1px solid #E5E7EB' }}>اختياري</span>
        ) : (
          <span style={{ color: '#DC2626', fontSize: '13px', lineHeight: 1 }}>*</span>
        )}
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{label}</span>
      </label>
      {children}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <p style={{ fontSize: '11px', color: '#DC2626' }}>{error}</p>
          <AlertCircle size={11} color="#DC2626" />
        </div>
      )}
    </div>
  );
}

const IS = (err) => ({
  width: '100%', padding: '9px 12px',
  border: `1.5px solid ${err ? '#FCA5A5' : '#E5E7EB'}`,
  borderRadius: '8px', fontFamily: 'Cairo, sans-serif',
  fontSize: '13px', color: '#374151', direction: 'rtl',
  outline: 'none', background: err ? '#FFF5F5' : 'white',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
  minHeight: '42px',
});

const SEL = (err) => ({
  ...IS(err),
  appearance: 'none', WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'left 12px center',
  paddingLeft: '32px', cursor: 'pointer',
});

const TA = (err, rows = 3) => ({
  ...IS(err),
  resize: 'vertical', minHeight: `${rows * 40}px`, lineHeight: 1.6,
});

function calcAge(dob) {
  if (!dob) return '';
  const birth = new Date(dob);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age > 0 ? age : '';
}

/* ─── Lookup tables ─────────────────────────────────────────── */

// For "أمين خدمة" — grouped stages
const STAGE_GROUPS = [
  { id: '',             label: 'اختر مجموعة المرحلة' },
  { id: 'KG_1_2',      label: 'حضانة (أولى + ثانية)' },
  { id: 'PRIMARY_1_2', label: 'ابتدائي (أولى + تانية)' },
  { id: 'PRIMARY_3_4', label: 'ابتدائي (تالتة + رابعة)' },
  { id: 'PRIMARY_5_6', label: 'ابتدائي (خامسة + سادسة)' },
  { id: 'PREPARATORY', label: 'إعدادي' },
  { id: 'SECONDARY',   label: 'ثانوي' },
  { id: 'UNIVERSITY',  label: 'جامعة' },
  { id: 'GRADUATES',   label: 'خريجين' },
];

// For "خادم مرحلة" — single year
const STAGES = [
  { id: '',                    label: 'اختر المرحلة' },
  { id: 'حضانة أولى',          label: 'حضانة أولى' },
  { id: 'حضانة ثانية',         label: 'حضانة ثانية' },
  { id: 'الأول الابتدائي',     label: 'الأول الابتدائي' },
  { id: 'الثاني الابتدائي',    label: 'الثاني الابتدائي' },
  { id: 'الثالث الابتدائي',    label: 'الثالث الابتدائي' },
  { id: 'الرابع الابتدائي',    label: 'الرابع الابتدائي' },
  { id: 'الخامس الابتدائي',    label: 'الخامس الابتدائي' },
  { id: 'السادس الابتدائي',    label: 'السادس الابتدائي' },
  { id: 'الأول الإعدادي',      label: 'الأول الإعدادي' },
  { id: 'الثاني الإعدادي',     label: 'الثاني الإعدادي' },
  { id: 'الثالث الإعدادي',     label: 'الثالث الإعدادي' },
  { id: 'الأول الثانوي',       label: 'الأول الثانوي' },
  { id: 'الثاني الثانوي',      label: 'الثاني الثانوي' },
  { id: 'الثالث الثانوي',      label: 'الثالث الثانوي' },
  { id: 'جامعة',               label: 'جامعة' },
  { id: 'خريجين',              label: 'خريجين' },
];

const ROLES = [
  { id: '',                label: 'اختر الدور' },
  { id: 'الأمانة العامة', label: 'الأمانة العامة' },
  { id: 'أمين خدمة',      label: 'أمين خدمة' },
  { id: 'خادم مرحلة',     label: 'خادم مرحلة' },
];

const EMPTY = {
  fullName: '', nickname: '', gender: 'ذكر', birthDate: '',
  email: '', phone: '', secondaryPhone: '',
  role: '', stageGroup: '', stage: '',
  serviceStartDate: '', status: 'نشط', supervisorName: '',
  address: '', nearestChurch: '',
  hobbies: '', notes: '', medicalNotes: '',
};

export default function AddServantPage() {
  const navigate = useNavigate();
  const [form,        setForm]        = useState(EMPTY);
  const [errors,      setErrors]      = useState({});
  const [saved,       setSaved]       = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [submitError, setSubmitError] = useState('');
  const age = calcAge(form.birthDate);

  // Role-based visibility
  const showStageGroup = form.role === 'أمين خدمة';
  const showStage      = form.role === 'خادم مرحلة';

  function set(field, val) {
    setForm(p => {
      const next = { ...p, [field]: val };
      // When role changes, clear the stage fields so stale values don't persist
      if (field === 'role') {
        next.stageGroup = '';
        next.stage      = '';
      }
      return next;
    });
    if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'الاسم الكامل مطلوب';
    if (!form.role)            e.role     = 'يرجى اختيار الدور';
    if (form.role === 'أمين خدمة' && !form.stageGroup)
                               e.stageGroup = 'يرجى اختيار مجموعة المرحلة';
    if (form.role === 'خادم مرحلة' && !form.stage)
                               e.stage      = 'يرجى اختيار المرحلة';
    if (form.phone.trim() && !/^01[0-9]{9}$/.test(form.phone.trim()))
                               e.phone      = 'رقم غير صحيح (مثال: 01xxxxxxxxx)';
    if (form.secondaryPhone.trim() && !/^01[0-9]{9}$/.test(form.secondaryPhone.trim()))
                               e.secondaryPhone = 'رقم غير صحيح (مثال: 01xxxxxxxxx)';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
                               e.email = 'بريد إلكتروني غير صحيح';
    return e;
  }

  async function handleSave(addAnother = false) {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      const firstErr = document.querySelector('[data-has-error="true"]');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    setSubmitError('');
    try {
      const newServant = await insertServant(form);
      console.log('[AddServantPage] insert success →', newServant);
      if (addAnother) {
        setForm(EMPTY); setErrors({});
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/servants');
      }
    } catch (err) {
      console.error('[AddServantPage] insert failed →', err);
      setSubmitError(`تعذّر حفظ الخادم: ${err?.message || 'حدث خطأ غير متوقع'}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '14px', fontWeight: 800, color: '#8B1A1A' }}>إضافة خادم جديد</span>
        <span style={{ color: '#D1D5DB', fontSize: '13px' }}>‹</span>
        <button onClick={() => navigate('/servants')} style={{
          fontSize: '13px', color: '#6B7280', background: 'none',
          border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
        }}>الخدام</button>
      </div>

      {/* Success toast */}
      {saved && (
        <div style={{
          position: 'fixed', top: '72px', left: '50%', transform: 'translateX(-50%)',
          background: '#16A34A', color: 'white', padding: '12px 24px', borderRadius: '10px',
          fontSize: '14px', fontWeight: 700, zIndex: 100,
          boxShadow: '0 4px 16px rgba(22,163,74,0.35)', animation: 'fadeIn 0.3s ease',
          display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap',
        }}>
          ✓ تم حفظ الخادم بنجاح!
        </div>
      )}

      {/* Error banner */}
      {submitError && (
        <div style={{
          background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '10px',
          padding: '14px 18px', marginBottom: '16px',
          display: 'flex', alignItems: 'flex-start', gap: '10px', justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#DC2626' }}>خطأ في الحفظ</p>
            <p style={{ fontSize: '13px', color: '#991B1B', marginTop: '2px' }}>{submitError}</p>
          </div>
          <AlertCircle size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
        </div>
      )}

      {/* Responsive two-column grid — stacks on mobile */}
      <div className="grid-half">

        {/* ══ Column 1 ══ */}
        <div>
          {/* 1. البيانات الأساسية */}
          <SectionCard icon={User} title="البيانات الأساسية">
            <div className="grid-form-2">
              <FormGroup label="الاسم الكنسي / اسم الشهرة" optional>
                <input value={form.nickname} onChange={e => set('nickname', e.target.value)}
                  placeholder="مثال: بيشوي" style={IS(false)}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
              </FormGroup>
              <div data-has-error={!!errors.fullName}>
                <FormGroup label="الاسم الكامل" error={errors.fullName}>
                  <input value={form.fullName} onChange={e => set('fullName', e.target.value)}
                    placeholder="أدخل الاسم الكامل" style={IS(errors.fullName)}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e  => e.target.style.borderColor = errors.fullName ? '#FCA5A5' : '#E5E7EB'} />
                </FormGroup>
              </div>
            </div>

            <div className="grid-form-2">
              <FormGroup label="تاريخ الميلاد" optional>
                <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)}
                  style={{ ...IS(false), colorScheme: 'light' }}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
              </FormGroup>
              <FormGroup label="النوع">
                <div style={{ display: 'flex', gap: '10px', paddingTop: '2px' }}>
                  {['ذكر', 'أنثى'].map(g => (
                    <button key={g} type="button" onClick={() => set('gender', g)} style={{
                      flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer',
                      fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px',
                      border: `2px solid ${form.gender === g ? '#8B1A1A' : '#E5E7EB'}`,
                      background: form.gender === g ? '#8B1A1A' : 'white',
                      color: form.gender === g ? 'white' : '#6B7280',
                      transition: 'all 0.15s', minHeight: '42px',
                    }}>{g}</button>
                  ))}
                </div>
              </FormGroup>
            </div>

            <div className="grid-form-2">
              <FormGroup label="العمر (محسوب)" optional>
                <div style={{
                  padding: '9px 12px', background: '#F9FAFB', borderRadius: '8px',
                  border: '1.5px solid #F3F4F6', fontSize: '13px', textAlign: 'right',
                  color: age ? '#111827' : '#9CA3AF', fontWeight: age ? 700 : 400,
                  fontFamily: 'Cairo, sans-serif', minHeight: '42px',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                }}>
                  {age ? `${age} سنوات` : '— سنوات'}
                </div>
              </FormGroup>
              <div data-has-error={!!errors.email}>
                <FormGroup label="البريد الإلكتروني" optional error={errors.email}>
                  <input type="email" dir="ltr" value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="example@mail.com"
                    style={{ ...IS(errors.email), textAlign: 'right' }}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e  => e.target.style.borderColor = errors.email ? '#FCA5A5' : '#E5E7EB'} />
                </FormGroup>
              </div>
            </div>

            <div className="grid-form-2">
              <FormGroup label="رقم هاتف إضافي" optional error={errors.secondaryPhone}>
                <input type="tel" dir="ltr" value={form.secondaryPhone}
                  onChange={e => set('secondaryPhone', e.target.value)}
                  placeholder="01xxxxxxxxx"
                  style={{ ...IS(errors.secondaryPhone), textAlign: 'right' }}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e  => e.target.style.borderColor = errors.secondaryPhone ? '#FCA5A5' : '#E5E7EB'} />
              </FormGroup>
              <div data-has-error={!!errors.phone}>
                <FormGroup label="رقم الهاتف الأساسي" optional error={errors.phone}>
                  <input type="tel" dir="ltr" value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="01xxxxxxxxx"
                    style={{ ...IS(errors.phone), textAlign: 'right' }}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e  => e.target.style.borderColor = errors.phone ? '#FCA5A5' : '#E5E7EB'} />
                </FormGroup>
              </div>
            </div>
          </SectionCard>

          {/* 2. بيانات الخدمة */}
          <SectionCard icon={Briefcase} title="بيانات الخدمة">

            {/* الدور — always visible */}
            <div data-has-error={!!errors.role}>
              <FormGroup label="الدور" error={errors.role}>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  style={SEL(errors.role)}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e  => e.target.style.borderColor = errors.role ? '#FCA5A5' : '#E5E7EB'}>
                  {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </FormGroup>
            </div>

            {/* مجموعة المرحلة — only for "أمين خدمة" */}
            {showStageGroup && (
              <div data-has-error={!!errors.stageGroup}>
                <FormGroup label="مجموعة المرحلة" error={errors.stageGroup}>
                  <select value={form.stageGroup} onChange={e => set('stageGroup', e.target.value)}
                    style={SEL(errors.stageGroup)}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e  => e.target.style.borderColor = errors.stageGroup ? '#FCA5A5' : '#E5E7EB'}>
                    {STAGE_GROUPS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </FormGroup>
              </div>
            )}

            {/* المرحلة — only for "خادم مرحلة" */}
            {showStage && (
              <div data-has-error={!!errors.stage}>
                <FormGroup label="المرحلة" error={errors.stage}>
                  <select value={form.stage} onChange={e => set('stage', e.target.value)}
                    style={SEL(errors.stage)}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e  => e.target.style.borderColor = errors.stage ? '#FCA5A5' : '#E5E7EB'}>
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </FormGroup>
              </div>
            )}

            <div className="grid-form-2">
              <FormGroup label="الحالة">
                <div style={{ display: 'flex', gap: '10px', paddingTop: '2px' }}>
                  {['نشط', 'غير نشط'].map(s => (
                    <button key={s} type="button" onClick={() => set('status', s)} style={{
                      flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer',
                      fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px',
                      border: `2px solid ${form.status === s ? '#8B1A1A' : '#E5E7EB'}`,
                      background: form.status === s ? '#8B1A1A' : 'white',
                      color: form.status === s ? 'white' : '#6B7280',
                      transition: 'all 0.15s', minHeight: '42px',
                    }}>{s}</button>
                  ))}
                </div>
              </FormGroup>
              <FormGroup label="تاريخ بداية الخدمة" optional>
                <input type="date" value={form.serviceStartDate}
                  onChange={e => set('serviceStartDate', e.target.value)}
                  style={{ ...IS(false), colorScheme: 'light' }}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
              </FormGroup>
            </div>

            <FormGroup label="اسم المشرف المباشر" optional>
              <input value={form.supervisorName} onChange={e => set('supervisorName', e.target.value)}
                placeholder="اسم المشرف أو المسؤول المباشر" style={IS(false)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
            </FormGroup>
          </SectionCard>

          {/* Action buttons */}
          <div className="mob-form-actions">
            <button onClick={() => navigate('/servants')} style={{
              padding: '10px 20px', borderRadius: '9px',
              background: 'transparent', border: 'none',
              fontFamily: 'Cairo, sans-serif', fontWeight: 700,
              fontSize: '13px', color: '#6B7280', cursor: 'pointer',
              textDecoration: 'underline',
            }}>إلغاء</button>

            <button onClick={() => handleSave(true)} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 22px', borderRadius: '9px',
              border: '2px solid #8B1A1A', background: 'white',
              color: '#8B1A1A', fontFamily: 'Cairo, sans-serif',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              transition: 'all 0.2s', minHeight: '44px', justifyContent: 'center',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              حفظ وإضافة خادم آخر
            </button>

            <button onClick={() => handleSave(false)} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '11px 24px', borderRadius: '9px',
              background: saving ? '#D1D5DB' : 'linear-gradient(135deg, #8B1A1A, #B52626)',
              color: 'white', fontFamily: 'Cairo, sans-serif',
              fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer',
              boxShadow: saving ? 'none' : '0 4px 12px rgba(139,26,26,0.3)',
              transition: 'all 0.2s', minHeight: '44px', justifyContent: 'center',
            }}>
              <Save size={15} />
              {saving ? 'جارٍ الحفظ...' : 'حفظ الخادم'}
            </button>
          </div>
        </div>

        {/* ══ Column 2 ══ */}
        <div>
          {/* 3. السكن والمتابعة */}
          <SectionCard icon={MapPin} title="السكن والمتابعة">
            <FormGroup label="المنطقة / العنوان" optional>
              <textarea value={form.address} onChange={e => set('address', e.target.value)}
                placeholder="العنوان بالتفصيل" style={TA(false, 2)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
            </FormGroup>
            <FormGroup label="أقرب كنيسة" optional>
              <input value={form.nearestChurch} onChange={e => set('nearestChurch', e.target.value)}
                placeholder="اسم الكنيسة" style={IS(false)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
            </FormGroup>
          </SectionCard>

          {/* 4. معلومات إضافية */}
          <SectionCard icon={Info} title="معلومات إضافية">
            <FormGroup label="المواهب والاهتمامات" optional>
              <input value={form.hobbies} onChange={e => set('hobbies', e.target.value)}
                placeholder="موسيقى، رسم، رياضة... (مفصولة بفاصلة)" style={IS(false)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
            </FormGroup>
            <FormGroup label="ملاحظات عامة" optional>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="أي ملاحظات رعوية أو خدمية مهمة..." style={TA(false, 3)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
            </FormGroup>
            <FormGroup label="ملاحظات صحية" optional>
              <textarea value={form.medicalNotes} onChange={e => set('medicalNotes', e.target.value)}
                placeholder="حساسية، أدوية، أو أي معلومات صحية مهمة..." style={TA(false, 2)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
            </FormGroup>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
