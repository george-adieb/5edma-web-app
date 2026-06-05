import { useState } from 'react';
import { supabase } from '../lib/supabase';

const SOURCE_LABELS = {
  attendance: 'حضور',
  activity:   'نشاط',
  manual:     'يدوي',
  correction: 'تصحيح',
};

const SOURCE_COLORS = {
  attendance: { bg: '#DCFCE7', color: '#16A34A' },
  activity:   { bg: '#F3E8FF', color: '#7C3AED' },
  manual:     { bg: '#DBEAFE', color: '#1D4ED8' },
  correction: { bg: '#FEF3C7', color: '#D97706' },
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function MyPointsPage() {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('get-student-points', {
        body: { code: trimmed },
      });

      if (fnErr) {
        setError('الكود غير صحيح، من فضلك راجع خادم الفصل');
        return;
      }

      if (data?.error === 'INVALID_CODE' || !data?.student_name) {
        setError('الكود غير صحيح، من فضلك راجع خادم الفصل');
        return;
      }

      setResult(data);
    } catch {
      setError('الكود غير صحيح، من فضلك راجع خادم الفصل');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError('');
    setCode('');
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1a0a0a 0%, #2d0f0f 40%, #1a0a0a 100%)',
      direction: 'rtl',
      fontFamily: "'Cairo', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px 60px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Decorative background circles */}
      <div style={{
        position: 'absolute', top: '-80px', right: '-80px',
        width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-60px', left: '-60px',
        width: '250px', height: '250px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,26,26,0.2) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo + Header */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '16px', marginTop: '40px', marginBottom: '32px',
        animation: 'fadeIn 0.5s ease',
      }}>
        <div style={{
          width: '88px', height: '88px', borderRadius: '22px',
          background: 'rgba(255,255,255,0.08)',
          border: '1.5px solid rgba(201,168,76,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          <img
            src="/church-logo.png"
            alt="شعار الكنيسة"
            style={{ width: '72px', height: '72px', objectFit: 'contain' }}
            onError={e => {
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = '<span style="font-size:36px">✝️</span>';
            }}
          />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: '28px', fontWeight: 900, color: 'white',
            marginBottom: '8px', letterSpacing: '-0.3px',
          }}>
            اعرف نقاطك
          </h1>
          <p style={{
            fontSize: '15px', color: 'rgba(255,255,255,0.55)',
            fontWeight: 500, lineHeight: 1.6,
          }}>
            اكتب كودك لمعرفة إجمالي نقاطك
          </p>
        </div>
      </div>

      {/* Main card */}
      <div style={{
        width: '100%', maxWidth: '460px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        animation: 'fadeIn 0.4s ease 0.1s both',
      }}>

        {/* Input form */}
        {!result && (
          <form onSubmit={handleSubmit} style={{ padding: '28px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 700,
              color: 'rgba(255,255,255,0.6)', marginBottom: '10px',
            }}>
              كود المخدوم
            </label>

            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                id="student-code-input"
                type="text"
                value={code}
                onChange={e => { setCode(e.target.value); setError(''); }}
                placeholder="مثال: STD-1234"
                autoComplete="off"
                autoCapitalize="characters"
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  border: error
                    ? '2px solid rgba(239,68,68,0.6)'
                    : '1.5px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'white',
                  fontSize: '18px',
                  fontFamily: "'Cairo', monospace",
                  fontWeight: 700,
                  outline: 'none',
                  letterSpacing: '1px',
                  textAlign: 'center',
                  direction: 'ltr',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(201,168,76,0.6)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.12)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = error
                    ? 'rgba(239,68,68,0.6)'
                    : 'rgba(255,255,255,0.15)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '10px', padding: '12px 14px',
                marginBottom: '16px', animation: 'fadeIn 0.2s ease',
              }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <span style={{ fontSize: '13px', color: '#FCA5A5', fontWeight: 600 }}>
                  {error}
                </span>
              </div>
            )}

            <button
              id="check-points-btn"
              type="submit"
              disabled={loading || !code.trim()}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: loading || !code.trim()
                  ? 'rgba(255,255,255,0.08)'
                  : 'linear-gradient(135deg, #8B1A1A 0%, #C9A84C 100%)',
                color: loading || !code.trim() ? 'rgba(255,255,255,0.3)' : 'white',
                fontSize: '15px',
                fontFamily: "'Cairo', sans-serif",
                fontWeight: 800,
                cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: loading || !code.trim() ? 'none' : '0 4px 20px rgba(139,26,26,0.4)',
              }}
            >
              {loading ? (
                <>
                  <svg
                    style={{ animation: 'spin 1s linear infinite' }}
                    width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  جاري التحقق...
                </>
              ) : (
                <>
                  <span style={{ fontSize: '18px' }}>⭐</span>
                  عرض النقاط
                </>
              )}
            </button>
          </form>
        )}

        {/* Results view */}
        {result && (
          <div style={{ animation: 'fadeIn 0.35s ease' }}>

            {/* Student header */}
            <div style={{
              background: 'linear-gradient(135deg, #8B1A1A 0%, #6B1414 100%)',
              padding: '24px 28px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px',
              }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', flexShrink: 0,
                }}>
                  🎓
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: '4px' }}>
                    {result.grade || 'المرحلة الدراسية'}
                  </p>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'white', lineHeight: 1.2 }}>
                    {result.student_name}
                  </h2>
                </div>
              </div>

              {/* Total points */}
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '14px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: '1px solid rgba(201,168,76,0.3)',
              }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: '4px' }}>
                    إجمالي النقاط
                  </p>
                  <p style={{
                    fontSize: '42px', fontWeight: 900, color: '#F0D98B', lineHeight: 1,
                  }}>
                    {result.total_points ?? 0}
                  </p>
                </div>
                <div style={{ fontSize: '48px', opacity: 0.7 }}>⭐</div>
              </div>
            </div>

            {/* Points history */}
            <div style={{ padding: '20px 24px' }}>
              <h3 style={{
                fontSize: '14px', fontWeight: 800,
                color: 'rgba(255,255,255,0.7)', marginBottom: '14px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span style={{ fontSize: '16px' }}>📋</span>
                آخر {result.logs?.length || 0} سجلات
              </h3>

              {!result.logs || result.logs.length === 0 ? (
                <p style={{
                  textAlign: 'center', color: 'rgba(255,255,255,0.35)',
                  fontSize: '13px', padding: '20px 0',
                }}>
                  لا توجد نقاط مسجلة بعد
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {result.logs.map((log, i) => {
                    const isPos   = log.points > 0;
                    const srcInfo = SOURCE_COLORS[log.source] || { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' };
                    const srcLabel = SOURCE_LABELS[log.source] || log.source;
                    return (
                      <div key={i} style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px', padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: '12px',
                      }}>
                        {/* Points badge */}
                        <div style={{
                          minWidth: '52px', textAlign: 'center',
                          padding: '6px 4px', borderRadius: '10px',
                          background: isPos ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          border: `1px solid ${isPos ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          fontSize: '16px', fontWeight: 900,
                          color: isPos ? '#4ADE80' : '#F87171',
                          flexShrink: 0,
                        }}>
                          {isPos ? '+' : ''}{log.points}
                        </div>

                        {/* Reason + meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.85)',
                            marginBottom: '5px',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {log.reason}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 700,
                              padding: '2px 8px', borderRadius: '20px',
                              background: srcInfo.bg, color: srcInfo.color,
                            }}>
                              {srcLabel}
                            </span>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                              {formatDate(log.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Search again button */}
              <button
                id="search-again-btn"
                onClick={handleReset}
                style={{
                  width: '100%', marginTop: '20px',
                  padding: '12px', borderRadius: '12px',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '13px', fontFamily: "'Cairo', sans-serif",
                  fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.target.style.borderColor = 'rgba(201,168,76,0.5)';
                  e.target.style.color = '#C9A84C';
                }}
                onMouseLeave={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.target.style.color = 'rgba(255,255,255,0.6)';
                }}
              >
                🔍 بحث عن كود آخر
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <p style={{
        marginTop: '32px', fontSize: '12px',
        color: 'rgba(255,255,255,0.2)', textAlign: 'center',
        animation: 'fadeIn 0.4s ease 0.3s both',
      }}>
        خدمة الأحد • نظام متابعة المخدومين
      </p>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        #student-code-input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
