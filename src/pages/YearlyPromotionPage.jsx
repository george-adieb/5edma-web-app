import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ChevronRight, AlertTriangle, CheckCircle, RefreshCcw, FileText } from 'lucide-react';

const PROMOTION_MAP = [
  ['حضانه أولى', 'حضانه ثانية'],
  ['حضانه ثانية', 'أولى ابتدائي'],
  ['الأول الابتدائي', 'الثاني الابتدائي'],
  ['الثاني الابتدائي', 'الثالث الابتدائي'],
  ['الثالث الابتدائي', 'الرابع الابتدائي'],
  ['الرابع الابتدائي', 'الخامس الابتدائي'],
  ['الخامس الابتدائي', 'السادس الابتدائي'],
  ['السادس الابتدائي', 'الأول الإعدادي'],
  ['الأول الإعدادي', 'الثاني الإعدادي'],
  ['الثاني الإعدادي', 'الثالث الإعدادي'],
  ['الثالث الإعدادي', 'الأول الثانوي'],
  ['الأول الثانوي', 'الثاني الثانوي'],
  ['الثاني الثانوي', 'الثالث الثانوي'],
  ['الثالث الثانوي', 'خريجين']
];

export default function YearlyPromotionPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [promotionYear, setPromotionYear] = useState('2026-2027');
  const [confirmationText, setConfirmationText] = useState('');
  const [executing, setExecuting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  if (profile?.role !== 'ADMIN') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}>
        <h2 style={{ color: '#DC2626' }}>غير مصرح لك بالدخول</h2>
        <p>هذه الصفحة مخصصة للأدمن فقط.</p>
      </div>
    );
  }

  async function handlePreview() {
    setLoadingPreview(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPreviewData(null);
    try {
      const { data, error } = await supabase.functions.invoke('yearly-promotion', {
        body: { action: 'preview' }
      });
      if (error) {
        console.error('Edge function error:', error);
        throw new Error('تعذر الاتصال بخدمة ترحيل السنة الدراسية');
      }
      if (!data) throw new Error('لا توجد استجابة من السيرفر');
      if (data.success === false) throw new Error(data.message || 'حدث خطأ غير معروف');
      
      setPreviewData(data);
    } catch (err) {
      console.error('Preview error:', err);
      setErrorMsg(err.message || 'تعذر تحميل المعاينة');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleExecute() {
    if (confirmationText !== 'أوافق على ترحيل السنة الدراسية') return;
    
    setExecuting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('yearly-promotion', {
        body: {
          action: 'execute',
          confirmationText,
          promotionYear
        }
      });
      if (error) {
        console.error('Edge function error:', error);
        throw new Error('تعذر الاتصال بخدمة ترحيل السنة الدراسية');
      }
      if (!data) throw new Error('لا توجد استجابة من السيرفر');
      if (data.success === false) throw new Error(data.message || 'حدث خطأ غير معروف');
      
      setSuccessMsg(data.message || 'تم ترحيل السنة الدراسية بنجاح!');
      setConfirmationText('');
      setPreviewData(null);
    } catch (err) {
      console.error('Execute error:', err);
      setErrorMsg(err.message || 'تعذر تنفيذ الترحيل');
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 20px', direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/settings')}
          style={{
            width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #E5E7EB',
            background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ChevronRight size={18} color="#4B5563" />
        </button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#111827', margin: 0 }}>ترحيل السنة الدراسية</h1>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>استخدم هذه الصفحة في بداية السنة لترحيل المخدومين والخدام إلى المرحلة التالية.</p>
        </div>
      </div>

      <div style={{
        background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px',
        padding: '16px', display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'flex-start'
      }}>
        <AlertTriangle size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#991B1B', margin: '0 0 4px' }}>تنبيه مهم:</h3>
          <p style={{ fontSize: '13px', color: '#B91C1C', margin: 0, lineHeight: 1.5 }}>
            هذه العملية ستغير المرحلة الدراسية للمخدومين والخدام. تأكد من أخذ نسخة احتياطية قبل التنفيذ.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div style={{
          background: '#FEF2F2', color: '#DC2626', padding: '12px 16px',
          borderRadius: '8px', border: '1px solid #FECACA', fontSize: '13px', fontWeight: 700,
          marginBottom: '20px', textAlign: 'center'
        }}>{errorMsg}</div>
      )}

      {successMsg && (
        <div style={{
          background: '#DCFCE7', color: '#166534', padding: '16px',
          borderRadius: '8px', border: '1px solid #BBF7D0', fontSize: '14px', fontWeight: 800,
          marginBottom: '20px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
        }}>
          <CheckCircle size={18} />
          {successMsg}
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#111827' }}>1. معاينة قواعد الترحيل</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
            background: '#F3F4F6', padding: '10px 16px', borderRadius: '8px', marginBottom: '12px',
            fontWeight: 800, fontSize: '13px', color: '#374151'
          }}>
            <div>الحالية</div>
            <div>ستصبح</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PROMOTION_MAP.map(([oldG, newG], idx) => (
              <div key={idx} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
                padding: '10px 16px', borderRadius: '8px', border: '1px solid #F3F4F6',
                fontSize: '13px', color: '#4B5563', fontWeight: 600
              }}>
                <div>{oldG}</div>
                <div style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ChevronRight size={14} /> {newG}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#111827' }}>2. الأعداد المتأثرة</h3>
        </div>
        <div style={{ padding: '20px' }}>
          {!previewData ? (
            <button
              onClick={handlePreview}
              disabled={loadingPreview}
              style={{
                padding: '10px 20px', borderRadius: '8px', background: 'white',
                border: '1.5px solid #D1D5DB', color: '#374151', fontSize: '14px', fontWeight: 800,
                cursor: loadingPreview ? 'not-allowed' : 'pointer', fontFamily: 'Cairo, sans-serif',
                display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', width: '100%'
              }}
            >
              {loadingPreview ? <RefreshCcw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={16} />}
              {loadingPreview ? 'جاري الفحص...' : 'معاينة الترحيل'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E3A8A' }}>عدد المخدومين:</span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#1D4ED8' }}>{previewData?.totals?.students || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#F5F3FF', borderRadius: '8px', border: '1px solid #DDD6FE' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#4C1D95' }}>عدد الخدام والمسؤولين:</span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#6D28D9' }}>{previewData?.totals?.profiles || 0}</span>
              </div>
              
              <button
                onClick={() => setPreviewData(null)}
                style={{
                  background: 'none', border: 'none', color: '#6B7280', fontSize: '12px',
                  fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
                  textDecoration: 'underline', alignSelf: 'center', marginTop: '4px'
                }}
              >إعادة المعاينة</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#111827' }}>3. تنفيذ الترحيل</h3>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#4B5563', marginBottom: '6px' }}>
              السنة الدراسية الجديدة
            </label>
            <input
              type="text"
              value={promotionYear}
              onChange={e => setPromotionYear(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #E5E7EB',
                fontFamily: 'Cairo, sans-serif', fontSize: '14px', direction: 'ltr', textAlign: 'right'
              }}
            />
          </div>

          <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '8px', border: '1px dashed #D1D5DB' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px', lineHeight: 1.5 }}>
              للتأكيد، اكتب الجملة التالية تماماً:<br/>
              <span style={{ color: '#8B1A1A', userSelect: 'all', background: '#FEF2F2', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '6px' }}>
                أوافق على ترحيل السنة الدراسية
              </span>
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={e => setConfirmationText(e.target.value)}
              placeholder="اكتب جملة التأكيد هنا..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #E5E7EB',
                fontFamily: 'Cairo, sans-serif', fontSize: '14px', direction: 'rtl'
              }}
            />
          </div>

          <button
            onClick={handleExecute}
            disabled={executing || confirmationText !== 'أوافق على ترحيل السنة الدراسية'}
            style={{
              padding: '12px 20px', borderRadius: '8px',
              background: (executing || confirmationText !== 'أوافق على ترحيل السنة الدراسية') ? '#D1D5DB' : 'linear-gradient(135deg,#8B1A1A,#B52626)',
              color: 'white', border: 'none', fontSize: '15px', fontWeight: 800,
              cursor: (executing || confirmationText !== 'أوافق على ترحيل السنة الدراسية') ? 'not-allowed' : 'pointer',
              fontFamily: 'Cairo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            {executing ? <RefreshCcw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {executing ? 'جاري التنفيذ...' : 'تنفيذ الترحيل'}
          </button>
          
        </div>
      </div>
      
      <div style={{ height: '40px' }} />
    </div>
  );
}
