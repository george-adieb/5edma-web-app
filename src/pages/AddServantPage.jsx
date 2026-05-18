import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Briefcase, Save, AlertCircle, CheckCircle2, Loader2, Key, Lock, Phone, MapPin, Info } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { GRADES } from '../data/constants';
import { useAuth } from '../contexts/AuthContext';

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div style={{ background:'white', borderRadius:'14px', padding:'18px 20px', border:'1px solid #F3F4F6', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', marginBottom:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'flex-end', marginBottom:'18px', paddingBottom:'12px', borderBottom:'1.5px solid #F9FAFB' }}>
        <h2 style={{ fontSize:'15px', fontWeight:800, color:'#111827', margin:0 }}>{title}</h2>
        <div style={{ width:'32px', height:'32px', borderRadius:'9px', flexShrink:0, background:'#FEF2F2', display:'flex', alignItems:'center', justifyContent:'center', color:'#8B1A1A' }}>
          <Icon size={16} />
        </div>
      </div>
      {children}
    </div>
  );
}

function FormGroup({ label, optional, error, children }) {
  return (
    <div style={{ marginBottom:'14px' }}>
      <label style={{ display:'flex', alignItems:'center', gap:'5px', justifyContent:'flex-end', marginBottom:'6px' }}>
        {optional ? <span style={{ fontSize:'10px', color:'#9CA3AF', background:'#F9FAFB', padding:'1px 6px', borderRadius:'4px', border:'1px solid #E5E7EB' }}>اختياري</span>
                  : <span style={{ color:'#DC2626', fontSize:'13px', lineHeight:1 }}>*</span>}
        <span style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>{label}</span>
      </label>
      {children}
      {error && <div style={{ display:'flex', alignItems:'center', gap:'4px', justifyContent:'flex-end', marginTop:'4px' }}><p style={{ fontSize:'11px', color:'#DC2626' }}>{error}</p><AlertCircle size={11} color="#DC2626" /></div>}
    </div>
  );
}

const IS = (err) => ({ width:'100%', padding:'9px 12px', border:`1.5px solid ${err?'#FCA5A5':'#E5E7EB'}`, borderRadius:'8px', fontFamily:'Cairo, sans-serif', fontSize:'13px', color:'#374151', direction:'rtl', outline:'none', background:err?'#FFF5F5':'white', boxSizing:'border-box', transition:'border-color 0.15s', minHeight:'42px' });
const SEL = (err) => ({ ...IS(err), appearance:'none', WebkitAppearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'left 12px center', paddingLeft:'32px', cursor:'pointer' });
const TA = (err) => ({ ...IS(err), resize:'vertical', minHeight:'80px', lineHeight:1.6 });

const ALL_GRADES   = GRADES.filter(g => g.id);
const ADMIN_ROLES  = [{ id:'', label:'اختر الدور' }, { id:'SERVANT', label:'خادم مرحلة' }, { id:'SERVICE_HEAD', label:'أمين خدمة' }, { id:'ADMIN', label:'الأمانة العامة' }];
const EMPTY = { fullName:'', email:'', password:'', role:'', gender:'', assignedGrade:'', assignedGrades:[], phone:'', address:'', job:'', confessionFather:'', status:'نشط', talents:'', notes:'' };

export default function AddServantPage() {
  const navigate = useNavigate();
  const { profile: cp } = useAuth();
  const isCallerAdmin = cp?.role === 'ADMIN' || cp?.role === 'GENERAL_SECRETARIAT';
  const isCallerSH    = cp?.role === 'SERVICE_HEAD';
  const allowedGrades = isCallerSH ? ALL_GRADES.filter(g => (cp?.assigned_grades||[]).includes(g.label)) : ALL_GRADES;

  const [form,        setForm]        = useState({ ...EMPTY, role: isCallerSH ? 'SERVANT' : '' });
  const [errors,      setErrors]      = useState({});
  const [saving,      setSaving]      = useState(false);
  const [result,      setResult]      = useState(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => { if (cp && !isCallerAdmin && !isCallerSH) navigate('/servants'); }, [cp]);

  const isServant = form.role === 'SERVANT';
  const isSH      = form.role === 'SERVICE_HEAD';
  const isAdminR  = form.role === 'ADMIN';

  function set(field, val) {
    setForm(prev => { const n = { ...prev, [field]: val }; if (field==='role') { n.assignedGrade=''; n.assignedGrades=[]; } return n; });
    if (errors[field]) setErrors(p => ({ ...p, [field]:'' }));
  }
  function toggleGrade(label) {
    setForm(prev => { const g = prev.assignedGrades.includes(label) ? prev.assignedGrades.filter(x=>x!==label) : [...prev.assignedGrades, label]; return { ...prev, assignedGrades: g }; });
    if (errors.assignedGrades) setErrors(p => ({ ...p, assignedGrades:'' }));
  }

  function validate() {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'الاسم الكامل مطلوب';
    if (!form.email.trim())    e.email    = 'البريد الإلكتروني مطلوب';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'بريد غير صحيح';
    if (!form.password.trim() || form.password.length < 8) e.password = 'كلمة المرور ٨ أحرف على الأقل';
    if (!form.role) e.role = 'يرجى اختيار الدور';
    if (isCallerSH && form.role !== 'SERVANT') e.role = 'غير مسموح — يمكنك إضافة خدام مرحلة فقط';
    if (isServant && !form.assignedGrade) e.assignedGrade = 'يرجى اختيار المرحلة';
    if (isCallerSH && isServant && form.assignedGrade && !(cp?.assigned_grades||[]).includes(form.assignedGrade)) e.assignedGrade = 'هذه المرحلة خارج نطاق إشرافك';
    if (isSH && form.assignedGrades.length === 0) e.assignedGrades = 'يرجى اختيار مرحلة واحدة على الأقل';
    return e;
  }

  async function handleSave(addAnother=false) {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); window.scrollTo({ top:0, behavior:'smooth' }); return; }
    setSaving(true); setSubmitError(''); setResult(null);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('انتهت جلسة الدخول، برجاء تسجيل الدخول مرة أخرى');
      }

      const payload = {
        email:            form.email.trim(),
        temporaryPassword:form.password.trim(),
        full_name:        form.fullName.trim(),
        role:             form.role,
        assigned_gender:  form.gender   || null,
        assigned_grade:   isServant ? form.assignedGrade  : null,
        assigned_grades:  isSH      ? form.assignedGrades : null,
        phone:            form.phone            || null,
        address:          form.address          || null,
        confession_father:form.confessionFather || null,
        job:              form.job              || null,
        status:           form.status           || 'نشط',
        talents:          form.talents          || null,
        notes:            form.notes            || null,
      };

      const { data, error: fnError } = await supabase.functions.invoke('create-servant-user', {
        body: payload,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (addAnother) {
        setResult({ isNew: data.isNew, name: data.full_name });
        setForm({ ...EMPTY, role: isCallerSH ? 'SERVANT' : '' });
        setErrors({});
        window.scrollTo({ top:0, behavior:'smooth' });
      } else {
        navigate('/servants');
      }
    } catch (err) {
      let msg = err?.message || 'حدث خطأ غير متوقع';
      if (msg.includes('Email rate limit')) msg = 'تم تجاوز حد الطلبات. انتظر قليلاً.';
      if (msg.includes('violates') && msg.includes('rls')) msg = 'غير مسموح. تحقق من صلاحيات قاعدة البيانات.';
      setSubmitError(msg); window.scrollTo({ top:0, behavior:'smooth' });
    } finally { setSaving(false); }
  }


  return (
    <div style={{ animation:'fadeIn 0.3s ease', direction:'rtl', fontFamily:'Cairo, sans-serif' }}>

      {/* Breadcrumb */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'18px', justifyContent:'flex-end' }}>
        <span style={{ fontSize:'14px', fontWeight:800, color:'#8B1A1A' }}>إضافة خادم جديد</span>
        <span style={{ color:'#D1D5DB', fontSize:'13px' }}>‹</span>
        <button onClick={() => navigate('/servants')} style={{ fontSize:'13px', color:'#6B7280', background:'none', border:'none', cursor:'pointer', fontFamily:'Cairo, sans-serif' }}>الخدام</button>
      </div>

      {/* SERVICE_HEAD scope notice */}
      {isCallerSH && (
        <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px', display:'flex', alignItems:'flex-start', gap:'10px', justifyContent:'flex-end' }}>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:'13px', fontWeight:700, color:'#92400E', marginBottom:'4px' }}>🔒 صلاحياتك كأمين خدمة</p>
            <p style={{ fontSize:'12px', color:'#78350F', lineHeight:1.7 }}>يمكنك إضافة <strong>خدام مرحلة</strong> فقط، ضمن: {(cp?.assigned_grades||[]).join('، ')||'—'}</p>
          </div>
          <Lock size={18} color="#92400E" style={{ flexShrink:0, marginTop:'2px' }} />
        </div>
      )}

      {/* Success */}
      {result && (
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:'10px', padding:'14px 18px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px', justifyContent:'flex-end', animation:'fadeIn 0.2s ease' }}>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:'14px', fontWeight:700, color:'#16A34A' }}>{result.isNew ? '✅ تم إنشاء حساب الخادم بنجاح!' : '✅ تم تحديث بيانات الخادم بنجاح!'}</p>
            <p style={{ fontSize:'12px', color:'#15803D', marginTop:'2px' }}>{result.name} — {result.isNew ? 'سيصله إيميل لتفعيل الحساب' : 'تم تحديث الدور والمرحلة'}</p>
          </div>
          <CheckCircle2 size={22} color="#16A34A" style={{ flexShrink:0 }} />
        </div>
      )}

      {/* Error */}
      {submitError && (
        <div style={{ background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:'10px', padding:'14px 18px', marginBottom:'16px', display:'flex', alignItems:'flex-start', gap:'10px', justifyContent:'flex-end', animation:'fadeIn 0.2s ease' }}>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:'14px', fontWeight:700, color:'#DC2626' }}>خطأ في الحفظ</p>
            <p style={{ fontSize:'13px', color:'#991B1B', marginTop:'2px' }}>{submitError}</p>
          </div>
          <AlertCircle size={20} color="#DC2626" style={{ flexShrink:0, marginTop:'2px' }} />
        </div>
      )}

      <div className="grid-half">

        {/* ══ Column 1 ══ */}
        <div>

          {/* 1. البيانات الأساسية */}
          <SectionCard icon={User} title="البيانات الأساسية">
            <div data-has-error={!!errors.fullName}>
              <FormGroup label="الاسم الكامل" error={errors.fullName}>
                <input value={form.fullName} onChange={e=>set('fullName',e.target.value)} placeholder="اكتب الاسم الكامل" style={IS(errors.fullName)} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor=errors.fullName?'#FCA5A5':'#E5E7EB'} />
              </FormGroup>
            </div>
            <FormGroup label="النوع" optional>
              <div style={{ display:'flex', gap:'10px' }}>
                {['ذكر','أنثى'].map(g => (
                  <button key={g} type="button" onClick={() => set('gender', form.gender===g ? '' : g)} style={{ flex:1, padding:'8px', borderRadius:'8px', cursor:'pointer', fontFamily:'Cairo, sans-serif', fontWeight:700, fontSize:'13px', border:`2px solid ${form.gender===g?'#8B1A1A':'#E5E7EB'}`, background:form.gender===g?'#8B1A1A':'white', color:form.gender===g?'white':'#6B7280', transition:'all 0.15s', minHeight:'42px' }}>{g}</button>
                ))}
              </div>
            </FormGroup>
            <FormGroup label="الحالة">
              <div style={{ display:'flex', gap:'10px' }}>
                {['نشط','غير نشط'].map(s => (
                  <button key={s} type="button" onClick={() => set('status', s)} style={{ flex:1, padding:'8px', borderRadius:'8px', cursor:'pointer', fontFamily:'Cairo, sans-serif', fontWeight:700, fontSize:'13px', border:`2px solid ${form.status===s?'#8B1A1A':'#E5E7EB'}`, background:form.status===s?'#8B1A1A':'white', color:form.status===s?'white':'#6B7280', transition:'all 0.15s', minHeight:'42px' }}>{s}</button>
                ))}
              </div>
            </FormGroup>
          </SectionCard>

          {/* 2. بيانات الحساب */}
          <SectionCard icon={Key} title="بيانات الحساب">
            <div data-has-error={!!errors.email}>
              <FormGroup label="البريد الإلكتروني" error={errors.email}>
                <input type="email" dir="ltr" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="servant@example.com" style={{...IS(errors.email),textAlign:'right'}} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor=errors.email?'#FCA5A5':'#E5E7EB'} />
              </FormGroup>
            </div>
            <div data-has-error={!!errors.password}>
              <FormGroup label="كلمة المرور المؤقتة" error={errors.password}>
                <input type="password" dir="ltr" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="••••••••" style={{...IS(errors.password),textAlign:'right'}} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor=errors.password?'#FCA5A5':'#E5E7EB'} />
              </FormGroup>
            </div>
          </SectionCard>

          {/* 3. بيانات التواصل */}
          <SectionCard icon={Phone} title="بيانات التواصل والمتابعة">
            <FormGroup label="رقم الموبايل" optional>
              <input type="tel" dir="ltr" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="01xxxxxxxxx" style={{...IS(false),textAlign:'right'}} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
            </FormGroup>
            <FormGroup label="العنوان" optional>
              <textarea value={form.address} onChange={e=>set('address',e.target.value)} placeholder="المنطقة أو العنوان بالتفصيل" style={TA(false)} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
            </FormGroup>
          </SectionCard>

          {/* Action buttons */}
          <div className="mob-form-actions">
            <button onClick={() => navigate('/servants')} style={{ padding:'10px 20px', borderRadius:'9px', background:'transparent', border:'none', fontFamily:'Cairo, sans-serif', fontWeight:700, fontSize:'13px', color:'#6B7280', cursor:'pointer', textDecoration:'underline' }}>إلغاء</button>
            <button onClick={() => handleSave(true)} disabled={saving} style={{ display:'flex', alignItems:'center', gap:'7px', padding:'10px 22px', borderRadius:'9px', border:'2px solid #8B1A1A', background:'white', color:'#8B1A1A', fontFamily:'Cairo, sans-serif', fontWeight:700, fontSize:'13px', cursor:saving?'not-allowed':'pointer', transition:'all 0.2s', minHeight:'44px', justifyContent:'center' }} onMouseEnter={e=>e.currentTarget.style.background='#FEF2F2'} onMouseLeave={e=>e.currentTarget.style.background='white'}>حفظ وإضافة خادم آخر</button>
            <button onClick={() => handleSave(false)} disabled={saving} style={{ display:'flex', alignItems:'center', gap:'7px', padding:'11px 24px', borderRadius:'9px', background:saving?'#D1D5DB':'linear-gradient(135deg,#8B1A1A,#B52626)', color:'white', fontFamily:'Cairo, sans-serif', fontWeight:700, fontSize:'13px', border:'none', cursor:saving?'not-allowed':'pointer', boxShadow:saving?'none':'0 4px 12px rgba(139,26,26,0.3)', transition:'all 0.2s', minHeight:'44px', justifyContent:'center' }}>
              {saving ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} /> جارٍ الحفظ...</> : <><Save size={15} /> حفظ الخادم</>}
            </button>
          </div>
        </div>

        {/* ══ Column 2 ══ */}
        <div>

          {/* 4. بيانات الخدمة */}
          <SectionCard icon={Briefcase} title="بيانات الخدمة">
            <div data-has-error={!!errors.role}>
              <FormGroup label="الدور في الخدمة" error={errors.role}>
                {isCallerSH ? (
                  <div style={{...IS(false), background:'#F9FAFB', color:'#374151', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    <Lock size={13} color="#9CA3AF" /><span>خادم مرحلة</span>
                  </div>
                ) : (
                  <select value={form.role} onChange={e=>set('role',e.target.value)} style={SEL(errors.role)} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor=errors.role?'#FCA5A5':'#E5E7EB'}>
                    {ADMIN_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                )}
              </FormGroup>
            </div>

            {isServant && (
              <div data-has-error={!!errors.assignedGrade}>
                <FormGroup label="المرحلة المسؤولة" error={errors.assignedGrade}>
                  <select value={form.assignedGrade} onChange={e=>set('assignedGrade',e.target.value)} style={SEL(errors.assignedGrade)} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor=errors.assignedGrade?'#FCA5A5':'#E5E7EB'}>
                    <option value="">اختر المرحلة</option>
                    {allowedGrades.map(g => <option key={g.id} value={g.label}>{g.label}</option>)}
                  </select>
                </FormGroup>
              </div>
            )}

            {isSH && (
              <div data-has-error={!!errors.assignedGrades}>
                <FormGroup label="المراحل المسؤولة" error={errors.assignedGrades}>
                  <div style={{ border:`1.5px solid ${errors.assignedGrades?'#FCA5A5':'#E5E7EB'}`, borderRadius:'8px', maxHeight:'200px', overflowY:'auto' }}>
                    {ALL_GRADES.map(g => {
                      const checked = form.assignedGrades.includes(g.label);
                      return (
                        <label key={g.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', cursor:'pointer', background:checked?'#FFF7F7':'transparent', borderBottom:'1px solid #F9FAFB', fontSize:'13px', color:'#374151' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleGrade(g.label)} style={{ accentColor:'#8B1A1A', width:'15px', height:'15px' }} />
                          {g.label}
                        </label>
                      );
                    })}
                  </div>
                  {form.assignedGrades.length > 0 && <p style={{ fontSize:'11px', color:'#6B7280', marginTop:'6px', textAlign:'right' }}>محدد: {form.assignedGrades.join('، ')}</p>}
                </FormGroup>
              </div>
            )}

            {isAdminR && (
              <div style={{ padding:'10px 14px', borderRadius:'8px', background:'#F0FDF4', border:'1px solid #BBF7D0', fontSize:'12px', color:'#15803D', textAlign:'right' }}>
                الأمانة العامة لها صلاحية على جميع المراحل
              </div>
            )}
          </SectionCard>

          {/* 5. معلومات إضافية */}
          <SectionCard icon={Info} title="معلومات إضافية">
            <FormGroup label="أب الاعتراف" optional>
              <input value={form.confessionFather} onChange={e=>set('confessionFather',e.target.value)} placeholder="اسم أب الاعتراف" style={IS(false)} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
            </FormGroup>
            <FormGroup label="الشغل / المهنة" optional>
              <input value={form.job} onChange={e=>set('job',e.target.value)} placeholder="مثال: مهندس، طالب، معلم" style={IS(false)} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
            </FormGroup>
            <FormGroup label="المواهب" optional>
              <input value={form.talents} onChange={e=>set('talents',e.target.value)} placeholder="مثال: موسيقى، رسم، خطابة" style={IS(false)} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
            </FormGroup>
            <FormGroup label="ملاحظات" optional>
              <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="أي ملاحظات رعوية أو خدمية..." style={TA(false)} onFocus={e=>e.target.style.borderColor='#8B1A1A'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
            </FormGroup>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
