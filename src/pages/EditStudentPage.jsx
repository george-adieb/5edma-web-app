import StudentStatusField, { validateStatusReason } from '../components/StudentStatusField';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  User, Info, Save, Loader2, Phone, MapPin, AlertCircle,
} from 'lucide-react';
import { fetchStudent, updateStudent, updateStudentLocation } from '../lib/database';
import ResponsibleServantField from '../components/ResponsibleServantField';
import { GRADES, REVERSE_GRADE_MAP, GRADE_LABEL_MAP } from '../data/constants';
import LocationPickerModal from '../components/LocationPickerModal';

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
          width: '32px', height: '32px', borderRadius: '9px',
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

function FormGroup({ label, optional, error, half, children }) {
  return (
    <div style={{ marginBottom: '14px', gridColumn: half ? 'span 1' : undefined }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        justifyContent: 'flex-end', marginBottom: '6px',
      }}>
        {optional ? (
          <span style={{ fontSize: '10px', color: '#9CA3AF', background: '#F9FAFB',
            padding: '1px 6px', borderRadius: '4px', border: '1px solid #E5E7EB' }}>
            اختياري
          </span>
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
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'left 12px center',
  paddingLeft: '32px',
  cursor: 'pointer',
});

const TA = (err, rows = 3) => ({
  ...IS(err),
  resize: 'vertical', minHeight: `${rows * 36}px`,
  lineHeight: 1.6,
});

function calcAge(dob) {
  if (!dob) return '';
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age > 0 ? age : '';
}

/* ─── Grade config ─────────────────────────────────────────── */



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


/* ─── Main page ─────────────────────────────────────────────── */
const EMPTY = {
  fullName: '', nickname: '', gender: 'ذكر', birthDate: '', grade: '',
  school: '',
  parentName: '', parentRelation: '', parentPhone: '', parentPhone2: '', motherName: '', studentPhone: '',
  address: '', nearestChurch: '', servant: '', studentStatus: 'منتظم', interruptionReason: '',
  notes: '', medicalNotes: '', hobbies: '',
};

export default function EditStudentPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [form,           setForm]           = useState(EMPTY);
  const [errors,         setErrors]         = useState({});
  const [saving,         setSaving]         = useState(false);
  const [submitError,    setSubmitError]    = useState('');
  const [savedScope,     setSavedScope]     = useState(null);   // stored grade/gender/servant

  // Location state (saved independently from the main form)
  const [studentLocation, setStudentLocation] = useState({ lat: null, lng: null, updated_at: null });
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationSuccess,    setLocationSuccess]    = useState(false);
  
  const age = calcAge(form.birthDate);

  useEffect(() => {
    async function loadStudent() {
      try {
        const student = await fetchStudent(id);
        
        let hobbiesText = '';
        if (Array.isArray(student.hobbies) && student.hobbies.length > 0) {
          hobbiesText = student.hobbies.join('، ');
        } else if (typeof student.hobbies === 'string') {
          hobbiesText = student.hobbies;
        }

        setForm({
          fullName: student.name || '',
          nickname: student.nickname || '',
          gender: student.gender || 'ذكر',
          birthDate: student.birth_date || '',
          grade: REVERSE_GRADE_MAP[student.grade] || student.grade || '', 
          school: student.school || '',
          parentName: student.parent_name || '',
          parentRelation: student.parent_relation || '',
          parentPhone: student.parent_phone || '',
          parentPhone2: student.parent_phone_2 || '',
          motherName: student.mother_name || '',
          studentPhone: student.student_phone || '',
          address: student.address || '',
          nearestChurch: student.nearest_church || '',
          servant: student.servant || '', 
          studentStatus: student.status || 'منتظم',
          interruptionReason: student.interruption_reason || '',
          notes: student.notes || '',
          medicalNotes: student.medical_notes || '',
          hobbies: hobbiesText,
        });
        setSavedScope({ grade: student.grade || '', gender: student.gender || 'ذكر', servant: student.servant || '' });
        setStudentLocation({
          lat: student.latitude ? parseFloat(student.latitude) : null,
          lng: student.longitude ? parseFloat(student.longitude) : null,
          updated_at: student.location_updated_at || null,
        });
      } catch (err) {
        console.error('Failed to load student:', err);
        setSubmitError('تعذّر تحميل بيانات المخدوم. قد يكون السجل غير موجود.');
      } finally {
        setLoadingInitial(false);
      }
    }
    loadStudent();
  }, [id]);

  function set(field, val) {
    setForm(p => ({ ...p, [field]: val }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.fullName.trim())      e.fullName      = 'الاسم الكامل مطلوب';
    if (!form.parentPhone.trim())   e.parentPhone   = 'رقم الهاتف مطلوب';
    else if (!/^01[0-9]{9}$/.test(form.parentPhone.trim()))
                                    e.parentPhone   = 'رقم غير صحيح (مثال: 01xxxxxxxxx)';
    if (form.studentPhone.trim() && !/^01[0-9]{9}$/.test(form.studentPhone.trim()))
      e.studentPhone = 'رقم غير صحيح (مثال: 01xxxxxxxxx)';
    if (form.parentPhone2.trim() && !/^01[0-9]{9}$/.test(form.parentPhone2.trim()))
                                    e.parentPhone2  = 'رقم غير صحيح (مثال: 01xxxxxxxxx)';
    const reasonErr = validateStatusReason(form.studentStatus, form.interruptionReason);
    if (reasonErr) e.interruptionReason = reasonErr;
    return e;
  }

  async function handleSave() {
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
      await updateStudent(id, form);
      // Navigate only after confirmed success
      navigate('/students');
    } catch (err) {
      console.error('[EditStudentPage] update failed →', err);
      const msg = err?.message || 'حدث خطأ غير متوقع';
      setSubmitError(`تعذّر حفظ التعديلات: ${msg}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLocation(lat, lng) {
    await updateStudentLocation(id, lat, lng);
    setStudentLocation({ lat, lng, updated_at: new Date().toISOString() });
    setLocationSuccess(true);
    setTimeout(() => setLocationSuccess(false), 3000);
  }

  if (loadingInitial) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '10px' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} />
        <p style={{ fontSize: '14px', color: '#9CA3AF', fontFamily: 'Cairo, sans-serif' }}>جاري تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <>
    <div style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '4px 8px', flexWrap: 'wrap',
        marginBottom: '18px', justifyContent: 'flex-end',
      }}>
        <span style={{ fontSize: '14px', fontWeight: 800, color: '#8B1A1A' }}>تعديل بيانات المخدوم</span>
        <span style={{ color: '#D1D5DB', fontSize: '13px' }}>‹</span>
        <button onClick={() => navigate(`/students/${id}`)} style={{ whiteSpace: 'nowrap',
          fontSize: '13px', color: '#6B7280', background: 'none',
          border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
        }}>ملف المخدوم</button>
        <span style={{ color: '#D1D5DB', fontSize: '13px' }}>‹</span>
        <button onClick={() => navigate('/students')} style={{ whiteSpace: 'nowrap',
          fontSize: '13px', color: '#6B7280', background: 'none',
          border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
        }}>المخدومين</button>
      </div>

      {/* Error banner */}
      {submitError && (
        <div style={{
          background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '10px',
          padding: '14px 18px', marginBottom: '16px',
          display: 'flex', alignItems: 'flex-start', gap: '10px', justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#DC2626' }}>خطأ</p>
            <p style={{ fontSize: '13px', color: '#991B1B', marginTop: '2px' }}>{submitError}</p>
          </div>
          <AlertCircle size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
        </div>
      )}

      {/* Two-column grid — stacks on mobile */}
      <div className="grid-half">

        {/* ══ RIGHT COLUMN ══ */}
        <div>
          {/* 1. البيانات الأساسية */}
          <SectionCard icon={User} title="البيانات الأساسية">
            <div className="grid-form-2">
              <FormGroup label="اسم الشهرة / الكنيسي" optional>
                <input
                  value={form.nickname}
                  onChange={e => set('nickname', e.target.value)}
                  placeholder="مثال: بيشوي"
                  style={IS(false)}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                />
              </FormGroup>
              <div data-has-error={!!errors.fullName}>
                <FormGroup label="الاسم الكامل (رباعي)" error={errors.fullName}>
                  <input
                    value={form.fullName}
                    onChange={e => set('fullName', e.target.value)}
                    placeholder="أدخل اسم المخدوم كما في شهادة الميلاد"
                    style={IS(errors.fullName)}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e => e.target.style.borderColor = errors.fullName ? '#FCA5A5' : '#E5E7EB'}
                  />
                </FormGroup>
              </div>
            </div>

            <div className="grid-form-2">
              <FormGroup label="تاريخ الميلاد" optional>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={e => set('birthDate', e.target.value)}
                  style={{ ...IS(false), colorScheme: 'light' }}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                />
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
                      transition: 'all 0.15s',
                    }}>{g}</button>
                  ))}
                </div>
              </FormGroup>
            </div>

            <div className="grid-form-2">
              <div data-has-error={!!errors.grade}>
                <FormGroup label="المرحلة الدراسية" optional>
                  <div style={{ position: 'relative' }}>
                    <select value={form.grade} onChange={e => set('grade', e.target.value)}
                      style={SEL(errors.grade)}
                      onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                      onBlur={e => e.target.style.borderColor = errors.grade ? '#FCA5A5' : '#E5E7EB'}
                    >
                      {GRADES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </FormGroup>
              </div>
              <FormGroup label="العمر (محسوب)" optional>
                <div style={{
                  padding: '9px 12px', background: '#F9FAFB', borderRadius: '8px',
                  border: '1.5px solid #F3F4F6', fontSize: '13px', textAlign: 'right',
                  color: age ? '#111827' : '#9CA3AF', fontWeight: age ? 700 : 400,
                  fontFamily: 'Cairo, sans-serif',
                }}>
                  {age ? `${age} سنوات` : '— سنوات'}
                </div>
              </FormGroup>
            </div>


            <FormGroup label="المدرسة" optional>
              <input
                value={form.school}
                onChange={e => set('school', e.target.value)}
                placeholder="اسم المدرسة (اختياري)"
                style={IS(false)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
            </FormGroup>
          </SectionCard>

          {/* 2. بيانات التواصل */}
          <SectionCard icon={Phone} title="بيانات التواصل">
            <div className="grid-form-2">
              <FormGroup label="صلة القرابة" optional>
                <select value={form.parentRelation} onChange={e => set('parentRelation', e.target.value)}
                  style={SEL(false)}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                >
                  {RELATIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </FormGroup>
              <div data-has-error={!!errors.parentName}>
                <FormGroup label="اسم ولي الأمر" optional error={errors.parentName}>
                  <input
                    value={form.parentName}
                    onChange={e => set('parentName', e.target.value)}
                    placeholder="الاسم بالكامل"
                    style={IS(errors.parentName)}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e => e.target.style.borderColor = errors.parentName ? '#FCA5A5' : '#E5E7EB'}
                  />
                </FormGroup>
              </div>
            </div>

            <div className="grid-form-2">
              <FormGroup label="رقم موبايل المخدوم (اختياري)" optional error={errors.studentPhone}>
                <input type="tel" dir="ltr" value={form.studentPhone}
                  onChange={e => set('studentPhone', e.target.value)}
                  placeholder="01xxxxxxxxx"
                  style={{ ...IS(errors.studentPhone), textAlign: 'right' }} />
              </FormGroup>
              <FormGroup label="اسم الأم" optional>
                <input value={form.motherName} onChange={e => set('motherName', e.target.value)}
                  placeholder="الاسم بالكامل" style={IS(false)} />
              </FormGroup>
            </div>

            <div className="grid-form-2">
              <FormGroup label="رقم آخر (اختياري)" optional error={errors.parentPhone2}>
                <input
                  type="tel" dir="ltr" value={form.parentPhone2}
                  onChange={e => set('parentPhone2', e.target.value)}
                  placeholder="01xxxxxxxxx"
                  style={{ ...IS(errors.parentPhone2), textAlign: 'right' }}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e => e.target.style.borderColor = errors.parentPhone2 ? '#FCA5A5' : '#E5E7EB'}
                />
              </FormGroup>
              <div data-has-error={!!errors.parentPhone}>
                <FormGroup label="رقم موبايل ولي الأمر" error={errors.parentPhone}>
                  <input
                    type="tel" dir="ltr" value={form.parentPhone}
                    onChange={e => set('parentPhone', e.target.value)}
                    placeholder="01xxxxxxxxx"
                    style={{ ...IS(errors.parentPhone), textAlign: 'right' }}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e => e.target.style.borderColor = errors.parentPhone ? '#FCA5A5' : '#E5E7EB'}
                  />
                </FormGroup>
              </div>
            </div>
          </SectionCard>

          {/* Action buttons — responsive via CSS class */}
          <div className="mob-form-actions">
            <button onClick={() => navigate('/students')} style={{ whiteSpace: 'nowrap',
              padding: '10px 20px', borderRadius: '9px',
              background: 'transparent', border: 'none',
              fontFamily: 'Cairo, sans-serif', fontWeight: 700,
              fontSize: '13px', color: '#6B7280', cursor: 'pointer',
              textDecoration: 'underline',
            }}>إلغاء</button>

            <button onClick={handleSave} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '11px 24px', borderRadius: '9px',
              background: saving ? '#D1D5DB' : 'linear-gradient(135deg, #8B1A1A, #B52626)',
              color: 'white', fontFamily: 'Cairo, sans-serif',
              fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer',
              boxShadow: saving ? 'none' : '0 4px 12px rgba(139,26,26,0.3)',
              transition: 'all 0.2s', minHeight: '44px', justifyContent: 'center',
            }}>
              <Save size={15} />
              {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </div>

        {/* ══ LEFT COLUMN ══ */}
        <div>
          {/* 3. العنوان والموقع */}
          <SectionCard icon={MapPin} title="العنوان والموقع">
            <FormGroup label="العنوان التفصيلي" optional>
              <textarea
                value={form.address}
                onChange={e => set('address', e.target.value)}
                placeholder="اكتب العنوان بالتفصيل: الشارع، رقم العمارة، الدور، علامة مميزة..."
                style={TA(false, 2)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
            </FormGroup>

            <FormGroup label="موقع السكن على الخريطة" optional>
              <div style={{
                padding: '12px', background: '#F9FAFB', borderRadius: '8px',
                border: '1.5px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '13px', color: studentLocation.lat ? '#16A34A' : '#6B7280', fontWeight: 600 }}>
                    {studentLocation.lat ? 'تم تحديد الموقع على الخريطة' : 'لم يتم تحديد الموقع على الخريطة بعد'}
                  </span>
                  <MapPin size={16} color={studentLocation.lat ? '#16A34A' : '#9CA3AF'} />
                </div>
                
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {studentLocation.lat && (
                    <button type="button" onClick={() => window.open(`https://maps.google.com/?q=${studentLocation.lat},${studentLocation.lng}`, '_blank')}
                      style={{
                        padding: '8px 14px', borderRadius: '7px', background: '#F0FDF4', color: '#16A34A',
                        border: '1px solid #BBF7D0', fontSize: '12px', fontWeight: 700, fontFamily: 'Cairo, sans-serif', cursor: 'pointer'
                      }}
                    >فتح في الخرائط</button>
                  )}
                  <button type="button" onClick={() => setShowLocationPicker(true)}
                    style={{
                      padding: '8px 14px', borderRadius: '7px', background: 'linear-gradient(135deg,#8B1A1A,#B52626)', color: 'white',
                      border: 'none', fontSize: '12px', fontWeight: 700, fontFamily: 'Cairo, sans-serif', cursor: 'pointer'
                    }}
                  >{studentLocation.lat ? 'تعديل الموقع على الخريطة' : 'تحديد الموقع على الخريطة'}</button>
                </div>

                {locationSuccess && (
                  <div style={{
                    marginTop: '4px', padding: '6px 10px', borderRadius: '6px',
                    background: '#DCFCE7', color: '#166534',
                    fontSize: '11px', fontWeight: 700, textAlign: 'center',
                  }}>✓ تم حفظ الموقع بنجاح</div>
                )}
              </div>
            </FormGroup>

            <p style={{ fontSize: '11px', color: '#6B7280', margin: '8px 0 16px', textAlign: 'right', lineHeight: 1.5 }}>
              العنوان التفصيلي يساعد الخادم في الوصول للمكان، وموقع الخريطة يستخدم لظهور المخدوم على خريطة الافتقاد.
            </p>

            <FormGroup label="أقرب كنيسة" optional>
              <input
                value={form.nearestChurch}
                onChange={e => set('nearestChurch', e.target.value)}
                placeholder="اسم الكنيسة"
                style={IS(false)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
            </FormGroup>

            <div data-has-error={!!errors.servant}>
              <FormGroup label="الخادم المسؤول" optional>
                <ResponsibleServantField
                  grade={GRADE_LABEL_MAP[form.grade] || form.grade}
                  gender={form.gender}
                  value={form.servant}
                  onChange={v => set('servant', v)}
                  error={errors.servant}
                  saved={savedScope}
                />
              </FormGroup>
            </div>

            {/* Status radio group */}
            <FormGroup label="حالة المتابعة الأولية">
              <StudentStatusField
                status={form.studentStatus}
                reason={form.interruptionReason}
                onStatusChange={v => set('studentStatus', v)}
                onReasonChange={v => set('interruptionReason', v)}
                error={errors.interruptionReason}
              />
            </FormGroup>
          </SectionCard>

          {/* 4. معلومات إضافية */}
          <SectionCard icon={Info} title="معلومات إضافية">
            <FormGroup label="المواهب والاهتمامات" optional>
              <input
                value={form.hobbies}
                onChange={e => set('hobbies', e.target.value)}
                placeholder="الجياد، رسم، رياضة... (مفصولة بفاصلة)"
                style={IS(false)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
            </FormGroup>

            <FormGroup label="ملاحظات طبية" optional>
              <textarea
                value={form.medicalNotes}
                onChange={e => set('medicalNotes', e.target.value)}
                placeholder="حساسية، أدوية، أو أي معلومات صحية مهمة..."
                style={TA(false, 2)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
            </FormGroup>

            <FormGroup label="ملاحظات عامة" optional>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="أي ملاحظات رعوية أو أسرية مهمة للخادم..."
                style={TA(false, 3)}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
            </FormGroup>
          </SectionCard>
        </div>
      </div>
    </div>
    <LocationPickerModal
      isOpen={showLocationPicker}
      onClose={() => setShowLocationPicker(false)}
      onSave={handleSaveLocation}
      initialLat={studentLocation.lat}
      initialLng={studentLocation.lng}
      studentName={form.fullName || ''}
    />
    </>
  );
}
