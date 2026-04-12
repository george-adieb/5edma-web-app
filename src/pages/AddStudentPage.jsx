import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Info, Save, Phone, Heart, MapPin, AlertCircle,
} from 'lucide-react';
import { insertStudent } from '../lib/database';
import { GRADES } from '../data/constants';

/* ─── Shared sub-components ─────────────────────────────── */

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

const RELATIONS = [
  { id: '', label: 'اختر صلة القرابة' },
  { id: 'الأب',    label: 'الأب'    },
  { id: 'الأم',    label: 'الأم'    },
  { id: 'الأخ',    label: 'الأخ'    },
  { id: 'الأخت',   label: 'الأخت'   },
  { id: 'الجد',    label: 'الجد'    },
  { id: 'الجدة',   label: 'الجدة'   },
  { id: 'عم / خال', label: 'عم / خال' },
  { id: 'أخرى',   label: 'أخرى'    },
];

const SERVANTS = [
  { id: '', label: 'اختر الخادم' },
  { id: 'mina',   label: 'أ. مينا كمال'    },
  { id: 'bishoy', label: 'أ. بيشوي أنطون'  },
  { id: 'marina', label: 'أ. مارينا يوسف'  },
  { id: 'peter',  label: 'أ. بطرس جرجس'    },
];

const EMPTY = {
  fullName: '', nickname: '', gender: 'ذكر', birthDate: '', grade: '',
  school: '', parentName: '', parentRelation: '', parentPhone: '', parentPhone2: '',
  address: '', nearestChurch: '', servant: '', studentStatus: 'منتظم',
  notes: '', medicalNotes: '', hobbies: '',
};

export default function AddStudentPage() {
  const navigate = useNavigate();
  const [form,        setForm]        = useState(EMPTY);
  const [errors,      setErrors]      = useState({});
  const [saved,       setSaved]       = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [submitError, setSubmitError] = useState('');
  const age = calcAge(form.birthDate);

  function set(field, val) {
    setForm(p => ({ ...p, [field]: val }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.fullName.trim())    e.fullName    = 'الاسم الكامل مطلوب';
    if (!form.grade)              e.grade       = 'يرجى اختيار المرحلة الدراسية';
    if (!form.parentName.trim())  e.parentName  = 'اسم ولي الأمر مطلوب';
    if (!form.parentPhone.trim()) e.parentPhone = 'رقم الهاتف مطلوب';
    else if (!/^01[0-9]{9}$/.test(form.parentPhone.trim()))
                                  e.parentPhone = 'رقم غير صحيح (مثال: 01xxxxxxxxx)';
    if (form.parentPhone2.trim() && !/^01[0-9]{9}$/.test(form.parentPhone2.trim()))
                                  e.parentPhone2 = 'رقم غير صحيح (مثال: 01xxxxxxxxx)';
    if (!form.servant)            e.servant = 'يرجى تحديد الخادم المسؤول';
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
      const newStudent = await insertStudent(form);
      console.log('[AddStudentPage] insert success →', newStudent);
      if (addAnother) {
        setForm(EMPTY); setErrors({});
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/students');
      }
    } catch (err) {
      console.error('[AddStudentPage] insert failed →', err);
      setSubmitError(`تعذّر حفظ الطالب: ${err?.message || 'حدث خطأ غير متوقع'}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '14px', fontWeight: 800, color: '#8B1A1A' }}>إضافة طالب جديد</span>
        <span style={{ color: '#D1D5DB', fontSize: '13px' }}>‹</span>
        <button onClick={() => navigate('/students')} style={{
          fontSize: '13px', color: '#6B7280', background: 'none',
          border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
        }}>الطلاب</button>
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
          ✓ تم حفظ الطالب بنجاح!
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
              <FormGroup label="اسم الشهرة / الكنيسي" optional>
                <input value={form.nickname} onChange={e => set('nickname', e.target.value)}
                  placeholder="مثال: بيشوي" style={IS(false)}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
              </FormGroup>
              <div data-has-error={!!errors.fullName}>
                <FormGroup label="الاسم الكامل (رباعي)" error={errors.fullName}>
                  <input value={form.fullName} onChange={e => set('fullName', e.target.value)}
                    placeholder="أدخل اسم الطالب كما في شهادة الميلاد" style={IS(errors.fullName)}
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
              <div data-has-error={!!errors.grade}>
                <FormGroup label="المرحلة الدراسية" error={errors.grade}>
                  <select value={form.grade} onChange={e => set('grade', e.target.value)}
                    style={SEL(errors.grade)}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e  => e.target.style.borderColor = errors.grade ? '#FCA5A5' : '#E5E7EB'}>
                    {GRADES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </FormGroup>
              </div>
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
            </div>

            <FormGroup label="المدرسة" optional>
              <input value={form.school} onChange={e => set('school', e.target.value)}
                placeholder="اسم المدرسة (اختياري)" style={IS(false)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
            </FormGroup>
          </SectionCard>

          {/* 2. بيانات ولي الأمر */}
          <SectionCard icon={Phone} title="بيانات ولي الأمر">
            <div className="grid-form-2">
              <FormGroup label="صلة القرابة" optional>
                <select value={form.parentRelation} onChange={e => set('parentRelation', e.target.value)}
                  style={SEL(false)}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'}>
                  {RELATIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </FormGroup>
              <div data-has-error={!!errors.parentName}>
                <FormGroup label="اسم ولي الأمر" error={errors.parentName}>
                  <input value={form.parentName} onChange={e => set('parentName', e.target.value)}
                    placeholder="الاسم بالكامل" style={IS(errors.parentName)}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e  => e.target.style.borderColor = errors.parentName ? '#FCA5A5' : '#E5E7EB'} />
                </FormGroup>
              </div>
            </div>

            <div className="grid-form-2">
              <FormGroup label="رقم هاتف إضافي" optional error={errors.parentPhone2}>
                <input type="tel" dir="ltr" value={form.parentPhone2}
                  onChange={e => set('parentPhone2', e.target.value)}
                  placeholder="01xxxxxxxxx"
                  style={{ ...IS(errors.parentPhone2), textAlign: 'right' }}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e  => e.target.style.borderColor = errors.parentPhone2 ? '#FCA5A5' : '#E5E7EB'} />
              </FormGroup>
              <div data-has-error={!!errors.parentPhone}>
                <FormGroup label="رقم الهاتف الأساسي" error={errors.parentPhone}>
                  <input type="tel" dir="ltr" value={form.parentPhone}
                    onChange={e => set('parentPhone', e.target.value)}
                    placeholder="01xxxxxxxxx"
                    style={{ ...IS(errors.parentPhone), textAlign: 'right' }}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e  => e.target.style.borderColor = errors.parentPhone ? '#FCA5A5' : '#E5E7EB'} />
                </FormGroup>
              </div>
            </div>
          </SectionCard>

          {/* Action buttons — responsive via CSS class */}
          <div className="mob-form-actions">
            <button onClick={() => navigate('/students')} style={{
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
              حفظ وإضافة آخر
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
              {saving ? 'جارٍ الحفظ...' : 'حفظ الطالب'}
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
            <div data-has-error={!!errors.servant}>
              <FormGroup label="الخادم المسؤول" error={errors.servant}>
                <select value={form.servant} onChange={e => set('servant', e.target.value)}
                  style={SEL(errors.servant)}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e  => e.target.style.borderColor = errors.servant ? '#FCA5A5' : '#E5E7EB'}>
                  {SERVANTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </FormGroup>
            </div>
            <FormGroup label="حالة المتابعة الأولية">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                {[
                  { value: 'منتظم',        label: 'طالب منتظم',              sub: 'يحضر بانتظام', color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
                  { value: 'جديد',          label: 'طالب جديد (يحتاج زيارة)', sub: 'أول مرة',      color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
                  { value: 'يحتاج افتقاد', label: 'منقطع (يحتاج افتقاد)',    sub: 'غائب فترة',   color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
                ].map(opt => (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '9px', cursor: 'pointer',
                    border: `1.5px solid ${form.studentStatus === opt.value ? opt.border : '#F3F4F6'}`,
                    background: form.studentStatus === opt.value ? opt.bg : 'white',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ textAlign: 'right', flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: form.studentStatus === opt.value ? opt.color : '#374151' }}>{opt.label}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{opt.sub}</p>
                    </div>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${form.studentStatus === opt.value ? opt.color : '#D1D5DB'}`,
                      background: form.studentStatus === opt.value ? opt.color : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {form.studentStatus === opt.value && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'white' }} />}
                    </div>
                    <input type="radio" name="status" value={opt.value}
                      checked={form.studentStatus === opt.value}
                      onChange={() => set('studentStatus', opt.value)}
                      style={{ display: 'none' }} />
                  </label>
                ))}
              </div>
            </FormGroup>
          </SectionCard>

          {/* 4. معلومات إضافية */}
          <SectionCard icon={Info} title="معلومات إضافية">
            <FormGroup label="المواهب والاهتمامات" optional>
              <input value={form.hobbies} onChange={e => set('hobbies', e.target.value)}
                placeholder="الجياد، رسم، رياضة... (مفصولة بفاصلة)" style={IS(false)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
            </FormGroup>
            <FormGroup label="ملاحظات طبية" optional>
              <textarea value={form.medicalNotes} onChange={e => set('medicalNotes', e.target.value)}
                placeholder="حساسية، أدوية، أو أي معلومات صحية مهمة..." style={TA(false, 2)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
            </FormGroup>
            <FormGroup label="ملاحظات عامة" optional>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="أي ملاحظات رعوية أو أسرية مهمة للخادم..." style={TA(false, 3)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'} />
            </FormGroup>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
