import { useState, useEffect } from 'react';
import { X, Star, Loader2, CheckCircle } from 'lucide-react';
import { addStudentPoints } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';

const PRESET_POINTS = [5, 10, 20, 50];

const SOURCE_OPTIONS = [
  { key: 'activity', label: 'نشاط',    color: '#7C3AED', bg: '#F3E8FF', icon: '🎯' },
  { key: 'manual',   label: 'يدوي',    color: '#1D4ED8', bg: '#DBEAFE', icon: '✏️' },
  { key: 'correction', label: 'تصحيح', color: '#D97706', bg: '#FEF3C7', icon: '🔧' },
];

const REASON_SUGGESTIONS = [
  'شارك في النشاط',
  'حفظ آية',
  'ساعد في النظام',
  'إجابة مميزة',
  'حضور مبكر',
  'تصرف بمسؤولية',
  'تعاون مع الفريق',
];

/**
 * AddPointsModal
 *
 * @param {boolean}   isOpen        Whether the modal is visible
 * @param {Function}  onClose       Callback when closed
 * @param {object}    student       { id, name, avatar, avatar_color } of the target student
 * @param {Function}  [onSuccess]   Callback after points are successfully added
 */
export default function AddPointsModal({ isOpen, onClose, student, onSuccess }) {
  const { profile } = useAuth();

  const [selectedPoints, setSelectedPoints] = useState(null);
  const [customPoints,   setCustomPoints]   = useState('');
  const [useCustom,      setUseCustom]      = useState(false);
  const [reason,         setReason]         = useState('');
  const [source,         setSource]         = useState('activity');
  const [saving,         setSaving]         = useState(false);
  const [success,        setSuccess]        = useState(false);
  const [error,          setError]          = useState('');

  // Reset state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPoints(null);
      setCustomPoints('');
      setUseCustom(false);
      setReason('');
      setSource('activity');
      setSaving(false);
      setSuccess(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const effectivePoints = useCustom
    ? (parseInt(customPoints, 10) || 0)
    : (selectedPoints || 0);

  const isValid =
    effectivePoints !== 0 &&
    reason.trim().length > 0 &&
    (source === 'correction' ? true : effectivePoints > 0);

  async function handleSubmit() {
    if (!isValid) return;
    setError('');
    setSaving(true);
    try {
      await addStudentPoints({
        studentId: student.id,
        points: effectivePoints,
        reason: reason.trim(),
        source,
        createdBy: profile?.id,
      });
      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1400);
    } catch (err) {
      console.error('[AddPointsModal] error:', err);
      setError(err.message || 'حدث خطأ أثناء إضافة النقاط');
    } finally {
      setSaving(false);
    }
  }

  const currentSource = SOURCE_OPTIONS.find(s => s.key === source) || SOURCE_OPTIONS[0];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 1000, animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', direction: 'rtl',
      }}>
        <div style={{
          background: 'white', borderRadius: '18px', width: '100%', maxWidth: '440px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          animation: 'slideUp 0.2s ease',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #8B1A1A 0%, #B52626 100%)',
            padding: '18px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: student?.avatar_color || '#C9A84C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '13px', fontWeight: 700, flexShrink: 0,
              }}>
                {student?.avatar || '?'}
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                  إضافة نقاط لـ
                </p>
                <p style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>
                  {student?.name || '—'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px',
                width: '32px', height: '32px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px' }}>

            {/* Success state */}
            {success && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '12px', padding: '24px 0',
                animation: 'fadeIn 0.2s ease',
              }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircle size={28} color="#16A34A" />
                </div>
                <p style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>
                  تم إضافة {effectivePoints} نقطة بنجاح! ✨
                </p>
              </div>
            )}

            {!success && (
              <>
                {/* 1. Points selector */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '10px' }}>
                    عدد النقاط *
                  </label>

                  {/* Preset buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                    {PRESET_POINTS.map(p => (
                      <button
                        key={p}
                        onClick={() => { setSelectedPoints(p); setUseCustom(false); }}
                        style={{
                          padding: '10px 6px', borderRadius: '10px', cursor: 'pointer',
                          fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: '16px',
                          border: '2px solid',
                          borderColor: (!useCustom && selectedPoints === p) ? '#8B1A1A' : '#E5E7EB',
                          background: (!useCustom && selectedPoints === p) ? '#FEF2F2' : 'white',
                          color: (!useCustom && selectedPoints === p) ? '#8B1A1A' : '#6B7280',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <Star size={12} fill={(!useCustom && selectedPoints === p) ? '#8B1A1A' : 'none'} color={(!useCustom && selectedPoints === p) ? '#8B1A1A' : '#D1D5DB'} />
                          {p}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Custom input toggle */}
                  <button
                    onClick={() => { setUseCustom(true); setSelectedPoints(null); }}
                    style={{
                      width: '100%', padding: '9px', borderRadius: '9px', cursor: 'pointer',
                      fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px',
                      border: '1.5px dashed',
                      borderColor: useCustom ? '#8B1A1A' : '#D1D5DB',
                      background: useCustom ? '#FEF2F2' : '#F9FAFB',
                      color: useCustom ? '#8B1A1A' : '#9CA3AF',
                      transition: 'all 0.15s',
                    }}
                  >
                    إدخال يدوي
                  </button>

                  {useCustom && (
                    <input
                      type="number"
                      value={customPoints}
                      onChange={e => setCustomPoints(e.target.value)}
                      placeholder={source === 'correction' ? 'أدخل قيمة موجبة أو سالبة' : 'أدخل عدد النقاط'}
                      min={source === 'correction' ? undefined : 1}
                      autoFocus
                      style={{
                        marginTop: '8px', width: '100%', padding: '10px 12px',
                        borderRadius: '9px', border: '1.5px solid #8B1A1A',
                        fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 700,
                        color: '#111827', outline: 'none', textAlign: 'center',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>

                {/* 2. Source type */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '10px' }}>
                    نوع النقاط
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {SOURCE_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setSource(opt.key)}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: '9px', cursor: 'pointer',
                          fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px',
                          border: '1.5px solid',
                          borderColor: source === opt.key ? opt.color : '#E5E7EB',
                          background: source === opt.key ? opt.bg : 'white',
                          color: source === opt.key ? opt.color : '#9CA3AF',
                          transition: 'all 0.15s',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Reason */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '8px' }}>
                    السبب *
                  </label>

                  {/* Reason suggestions */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {REASON_SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => setReason(s)}
                        style={{
                          padding: '5px 10px', borderRadius: '20px', cursor: 'pointer',
                          fontFamily: 'Cairo, sans-serif', fontWeight: 600, fontSize: '11px',
                          border: '1px solid',
                          borderColor: reason === s ? '#8B1A1A' : '#E5E7EB',
                          background: reason === s ? '#FEF2F2' : '#F9FAFB',
                          color: reason === s ? '#8B1A1A' : '#6B7280',
                          transition: 'all 0.12s',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="اكتب سبباً أو اختر من الأعلى..."
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '9px',
                      border: '1.5px solid #E5E7EB', fontFamily: 'Cairo, sans-serif',
                      fontSize: '13px', color: '#111827', outline: 'none',
                      direction: 'rtl', boxSizing: 'border-box',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>

                {/* Preview badge */}
                {effectivePoints !== 0 && reason.trim() && (
                  <div style={{
                    background: '#F9FAFB', borderRadius: '10px', padding: '12px 14px',
                    border: '1px solid #E5E7EB', marginBottom: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    animation: 'fadeIn 0.2s ease',
                  }}>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>معاينة:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        background: currentSource.bg, color: currentSource.color,
                      }}>
                        {currentSource.icon} {currentSource.label}
                      </span>
                      <span style={{
                        fontSize: '16px', fontWeight: 900,
                        color: effectivePoints > 0 ? '#16A34A' : '#DC2626',
                      }}>
                        {effectivePoints > 0 ? '+' : ''}{effectivePoints}
                      </span>
                      <span style={{ fontSize: '12px', color: '#374151' }}>— {reason}</span>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
                    padding: '10px 14px', marginBottom: '14px',
                    fontSize: '13px', color: '#DC2626', fontWeight: 600,
                  }}>
                    ⚠️ {error}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={onClose}
                    style={{
                      flex: 1, padding: '11px', borderRadius: '10px', cursor: 'pointer',
                      fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px',
                      border: '1.5px solid #E5E7EB', background: 'white', color: '#6B7280',
                    }}
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!isValid || saving}
                    style={{
                      flex: 2, padding: '11px', borderRadius: '10px', cursor: isValid && !saving ? 'pointer' : 'not-allowed',
                      fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px',
                      border: 'none',
                      background: isValid && !saving
                        ? 'linear-gradient(135deg, #8B1A1A, #B52626)'
                        : '#D1D5DB',
                      color: 'white',
                      opacity: isValid && !saving ? 1 : 0.7,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {saving
                      ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> جاري الحفظ...</>
                      : <><Star size={14} /> إضافة {effectivePoints > 0 ? effectivePoints : '—'} نقطة</>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </>
  );
}
