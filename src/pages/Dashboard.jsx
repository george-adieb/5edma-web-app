import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Save, AlertCircle } from 'lucide-react';
import { fetchDashboardStats, fetchAbsentForDate } from '../lib/database';
import { getActiveFriday } from '../lib/attendanceCycle';
import { alerts } from '../data/mockData';

// ── Shared card shell style ────────────────────────────────────
const S = {
  card: {
    background: 'white',
    borderRadius: '14px',
    padding: '20px',
    border: '1px solid #F3F4F6',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
};

// ── Skeleton number shown while loading ───────────────────────
function Skeleton({ width = '60px', height = '40px' }) {
  return (
    <div style={{
      width, height, borderRadius: '8px',
      background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      display: 'inline-block',
    }} />
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  // ── Active Friday cycle — used for attendance queries ────────
  const activeFriday = getActiveFriday();

  // ── State ────────────────────────────────────────────────────
  const [stats,      setStats]      = useState(null);   // fetchDashboardStats result
  const [absentList, setAbsentList] = useState([]);     // absent students list
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // ── Fetch on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Run stats + absent list in parallel; each is independently safe
        const [statsResult, absentResult] = await Promise.allSettled([
          fetchDashboardStats(activeFriday),
          fetchAbsentForDate(activeFriday),
        ]);

        if (cancelled) return;

        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value);
        } else {
          console.error('[Dashboard] stats error →', statsResult.reason);
          setError('تعذّر تحميل بعض الإحصائيات. يتم عرض بيانات جزئية.');
          setStats(null);
        }

        if (absentResult.status === 'fulfilled') {
          setAbsentList(absentResult.value);
        } else {
          console.error('[Dashboard] absentList error →', absentResult.reason);
          setAbsentList([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [activeFriday]);

  // ── Safe accessors with fallback ─────────────────────────────
  const totalStudents  = stats?.totalStudents  ?? 0;
  const presentCount   = stats?.presentCount   ?? 0;
  const absentCount    = stats?.absentCount    ?? 0;
  const needFollowUp   = stats?.needFollowUp   ?? 0;
  const avatarStudents = stats?.avatarStudents ?? [];

  const pad2 = n => String(n).padStart(2, '0');

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', direction: 'rtl' }}>

      {/* Page Title */}
      <div style={{ textAlign: 'right', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>لوحة التحكم</h1>
        <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
          مرحباً بك مجدداً. إليك ملخص نشاط الخدمة لهذا اليوم.
        </p>
      </div>

      {/* Partial-error banner — shown when stats failed but page didn't crash */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start',
          background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: '10px',
          padding: '10px 14px', marginBottom: '16px',
          fontSize: '12px', fontWeight: 700, color: '#D97706',
        }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Row 1: Three stat cards ── */}
      <div className="grid-stats">

        {/* حضور اليوم */}
        <div
          onClick={() => navigate('/attendance')}
          style={{ ...S.card, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
              background: '#DCFCE7', color: '#16A34A',
            }}>اليوم</span>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
              background: '#DCFCE7', color: '#16A34A',
            }}>التفاصيل ‹</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px' }}>حضور اليوم</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: 'flex-start' }}>
              {loading ? (
                <Skeleton width="70px" height="42px" />
              ) : (
                <>
                  <span style={{ fontSize: '40px', fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                    {presentCount}
                  </span>
                  <span style={{ fontSize: '13px', color: '#9CA3AF' }}>/ {totalStudents} طالب</span>
                </>
              )}
            </div>
          </div>

          {/* Mini avatars */}
          <div style={{ display: 'flex', marginTop: '12px' }}>
            {loading ? (
              // Skeleton avatar row
              [0,1,2,3].map(i => (
                <div key={i} style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  background: '#E5E7EB', border: '2px solid white',
                  marginRight: i > 0 ? '-8px' : '0',
                  position: 'relative', zIndex: 4 - i,
                }} />
              ))
            ) : (
              <>
                {avatarStudents.slice(0, 4).map((s, i) => (
                  <div key={s.id} style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: s.avatar_color || '#8B1A1A', border: '2px solid white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', color: 'white', fontWeight: 700,
                    marginRight: i > 0 ? '-8px' : '0',
                    position: 'relative', zIndex: 4 - i,
                  }}>
                    {(s.avatar || '').charAt(0)}
                  </div>
                ))}
                {totalStudents > 4 && (
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: '#E5E7EB', border: '2px solid white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', color: '#6B7280', fontWeight: 700,
                    marginRight: '-8px', zIndex: 0,
                  }}>
                    {totalStudents - 4}+
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* حالات غياب غير مبررة */}
        <div style={{ ...S.card, cursor: 'pointer' }} onClick={() => navigate('/attendance')}>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px',
            }}>🚫</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px' }}>حالات غياب غير مبررة</p>
            {loading ? (
              <Skeleton width="60px" height="42px" />
            ) : (
              <p style={{ fontSize: '40px', fontWeight: 900, color: '#DC2626', lineHeight: 1 }}>
                {pad2(absentCount)}
              </p>
            )}
          </div>
        </div>

        {/* محتاجين افتقاد عاجل */}
        <div style={{ ...S.card, cursor: 'pointer' }} onClick={() => navigate('/followup')}>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px',
            }}>🤝</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px' }}>محتاجين افتقاد عاجل</p>
            {loading ? (
              <Skeleton width="60px" height="42px" />
            ) : (
              <p style={{ fontSize: '40px', fontWeight: 900, color: '#D97706', lineHeight: 1 }}>
                {pad2(needFollowUp)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Follow-up list + Alerts ── */}
      <div className="grid-two-col">

        {/* بانتظار الافتقاد */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>بانتظار الافتقاد</h2>
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                الطلاب الغائبون بانتظار تواصل الخادم معهم.
              </p>
            </div>
            <button
              onClick={() => navigate('/followup')}
              style={{ fontSize: '12px', fontWeight: 700, color: '#8B1A1A', background: 'none', border: 'none', cursor: 'pointer' }}
            >مشاهدة الكل ‹</button>
          </div>

          {/* Loading skeleton rows */}
          {loading && (
            [0,1,2].map(i => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                  <div>
                    <Skeleton width="100px" height="14px" />
                    <div style={{ marginTop: '4px' }}><Skeleton width="60px" height="11px" /></div>
                  </div>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F3F4F6', flexShrink: 0 }} />
                </div>
              </div>
            ))
          )}

          {/* Real absent students */}
          {!loading && absentList.map(student => (
            <div key={student.id} style={{
              padding: '10px 0', borderBottom: '1px solid #F9FAFB',
              direction: 'rtl',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: student.avatar_color || student.avatarColor || '#8B1A1A',
                    color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700,
                  }}>{student.avatar}</div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{student.name}</p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{student.grade}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <a href={`tel:${student.parent_phone || student.parentPhone}`} style={{
                    width: '30px', height: '30px', borderRadius: '7px',
                    border: '1.5px solid #E5E7EB', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#6B7280', textDecoration: 'none', background: 'white',
                  }}>
                    <Phone size={13} />
                  </a>
                  <button
                    onClick={() => navigate(`/students/${student.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '5px 10px', borderRadius: '7px',
                      background: '#8B1A1A', color: 'white',
                      border: 'none', cursor: 'pointer',
                      fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: 700,
                    }}
                  >
                    <Save size={11} />إضافة ملاحظة
                  </button>
                </div>
              </div>
              <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '11px', padding: '3px 8px', borderRadius: '20px',
                  background: '#FEE2E2', color: '#DC2626', fontWeight: 600,
                }}>غائب هذا الأسبوع</span>
                <span style={{ fontSize: '11px', color: '#6B7280' }}>لم يتم التواصل</span>
              </div>
            </div>
          ))}

          {!loading && absentList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <p style={{ fontSize: '24px', marginBottom: '8px' }}>🎉</p>
              <p style={{ fontSize: '13px', color: '#6B7280' }}>لا يوجد غائبون هذا الأسبوع</p>
            </div>
          )}
        </div>

        {/* تنبيهات هامة */}
        <div style={{
          background: 'linear-gradient(160deg, #8B1A1A 0%, #6B1414 100%)',
          borderRadius: '14px', padding: '20px',
          boxShadow: '0 4px 16px rgba(139,26,26,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>تنبيهات هامة</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alerts.map(alert => (
              <div key={alert.id} style={{
                background: 'rgba(255,255,255,0.12)', borderRadius: '10px',
                padding: '12px 14px', textAlign: 'right',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', justifyContent: 'flex-start' }}>
                  <span style={{ fontSize: '16px' }}>{alert.icon}</span>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{alert.title}</p>
                </div>
                <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                  {alert.text}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
