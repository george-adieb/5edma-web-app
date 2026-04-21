import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Save, AlertCircle, Plus, X, Loader2 } from 'lucide-react';
import { fetchDashboardStats, fetchAbsentForDate, fetchActiveAlerts, saveSystemAlert, fetchUpcomingBirthdays } from '../lib/database';
import { getActiveFriday } from '../lib/attendanceCycle';
import { useAuth } from '../contexts/AuthContext';

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

  const { profile } = useAuth();
  const canAddAlert = ['ADMIN', 'الأمانة العامة', 'أمين خدمة'].includes(profile?.role);

  // ── State ────────────────────────────────────────────────────
  const [stats,      setStats]      = useState(null);   // fetchDashboardStats result
  const [absentList, setAbsentList] = useState([]);     // absent students list
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // ── Alert Modal State ─────────────────────────────────────────
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [alertTitle,   setAlertTitle]   = useState('');
  const [alertText,    setAlertText]    = useState('');
  const [alertIcon,    setAlertIcon]    = useState('⚠️');
  const [alertDuration, setAlertDuration] = useState(7);
  const [isSavingAlert, setIsSavingAlert] = useState(false);

  // ── Fetch on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Run stats + absent list in parallel; each is independently safe
        const [statsResult, absentResult, alertsResult, birthdaysResult] = await Promise.allSettled([
          fetchDashboardStats(activeFriday),
          fetchAbsentForDate(activeFriday),
          fetchActiveAlerts(),
          fetchUpcomingBirthdays(),
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

        if (alertsResult.status === 'fulfilled') {
          setSystemAlerts(alertsResult.value);
        } else {
          setSystemAlerts([]);
        }

        if (birthdaysResult.status === 'fulfilled') {
          setUpcomingBirthdays(birthdaysResult.value);
        } else {
          setUpcomingBirthdays([]);
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

  async function handleAddAlert(e) {
    e.preventDefault();
    if (!alertTitle.trim() || !alertText.trim()) return;
    setIsSavingAlert(true);
    try {
      await saveSystemAlert({
        title: alertTitle.trim(),
        text: alertText.trim(),
        type: alertIcon,
        durationDays: Number(alertDuration),
      });
      setShowAddAlert(false);
      setAlertTitle('');
      setAlertText('');
      setAlertIcon('⚠️');
      setAlertDuration(7);
      
      // reload
      const updated = await fetchActiveAlerts();
      setSystemAlerts(updated);
    } catch (err) {
      console.error('Failed to save alert', err);
      alert('تعذّر إضافة التنبيه. يرجى المحاولة لاحقاً.');
    } finally {
      setIsSavingAlert(false);
    }
  }

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
                  <span style={{ fontSize: '13px', color: '#9CA3AF' }}>/ {totalStudents} مخدوم</span>
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
                المخدومين الغائبون بانتظار تواصل الخادم معهم.
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>تنبيهات هامة</h2>
            </div>
            {canAddAlert && (
              <button 
                onClick={() => setShowAddAlert(true)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                  padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontFamily: 'Cairo, sans-serif'
                }}>
                <Plus size={14} /> إضافة تنبيه
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcomingBirthdays.length > 0 && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.12)', borderRadius: '10px',
                padding: '12px 14px', textAlign: 'right',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                animation: 'fadeIn 0.4s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', justifyContent: 'flex-start' }}>
                  <span style={{ fontSize: '18px' }}>🎂</span>
                  <p style={{ fontSize: '13.5px', fontWeight: 800, color: 'white' }}>أعياد ميلاد قريبة</p>
                  <span style={{
                    marginRight: 'auto', background: 'rgba(255,255,255,0.2)', color: 'white',
                    fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '12px'
                  }}>
                    {upcomingBirthdays.length} مخدومين
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, marginBottom: '8px' }}>
                  عندك {upcomingBirthdays.length} مخدومين عيد ميلادهم الأسبوع ده – حضّر للاحتفال الجمعة 🎉
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {upcomingBirthdays.slice(0, 5).map(b => (
                    <div key={b.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(0,0,0,0.15)', padding: '6px 10px', borderRadius: '6px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                          background: b.avatar_color || '#8B1A1A', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 700
                        }}>
                          {b.avatar}
                        </div>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'white' }}>{b.name}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#FCD34D', fontWeight: 700 }}>
                        {b.daysUntil === 0 ? 'اليوم!' : b.daysUntil === 1 ? 'غداً!' : `بعد ${b.daysUntil} أيام`} ({b.formattedBday})
                      </div>
                    </div>
                  ))}
                  {upcomingBirthdays.length > 5 && (
                    <div style={{ textAlign: 'center', fontSize: '11px', color: 'white', marginTop: '4px', opacity: 0.8 }}>
                      و {upcomingBirthdays.length - 5} آخرين...
                    </div>
                  )}
                </div>
              </div>
            )}

            {systemAlerts.length === 0 && upcomingBirthdays.length === 0 ? (
              <div style={{
                background: 'rgba(255,255,255,0.1)', borderRadius: '10px',
                padding: '20px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.2)',
              }}>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>لا توجد تنبيهات حالية.</p>
              </div>
            ) : (
              systemAlerts.map(alert => (
                <div key={alert.id} style={{
                  background: 'rgba(255,255,255,0.12)', borderRadius: '10px',
                  padding: '12px 14px', textAlign: 'right',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', justifyContent: 'flex-start' }}>
                    <span style={{ fontSize: '16px' }}>{alert.alert_type || alert.icon || '⚠️'}</span>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{alert.title}</p>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                    {alert.description || alert.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Add Alert Modal */}
      {showAddAlert && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          fontFamily: 'Cairo, sans-serif', direction: 'rtl'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '100%', maxWidth: '400px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'scaleUp 0.3s ease'
          }}>
            <div style={{ background: '#F9FAFB', padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>إضافة تنبيه جديد</h3>
              <button onClick={() => setShowAddAlert(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddAlert} style={{ padding: '20px' }}>
              
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>عنوان التنبيه <span style={{color: '#DC2626'}}>*</span></label>
                <input required value={alertTitle} onChange={e => setAlertTitle(e.target.value)} type="text" placeholder="مثال: موعد قداس الخدمة" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontFamily: 'Cairo', fontSize: '13px', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>وصف التنبيه <span style={{color: '#DC2626'}}>*</span></label>
                <textarea required value={alertText} onChange={e => setAlertText(e.target.value)} placeholder="اكتب تفاصيل التنبيه بوضوح..." style={{ width: '100%', height: '80px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontFamily: 'Cairo', fontSize: '13px', outline: 'none', resize: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>فترة الظهور</label>
                  <select value={alertDuration} onChange={e => setAlertDuration(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontFamily: 'Cairo', fontSize: '13px', outline: 'none', background: 'white' }}>
                    <option value={1}>يوم واحد</option>
                    <option value={3}>٣ أيام</option>
                    <option value={7}>أسبوع</option>
                    <option value={14}>أسبوعين</option>
                    <option value={30}>شهر</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>الأيقونة</label>
                  <select value={alertIcon} onChange={e => setAlertIcon(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontFamily: 'Cairo', fontSize: '16px', outline: 'none', background: 'white' }}>
                    <option value="⚠️">⚠️ تحذير</option>
                    <option value="📅">📅 تقويم</option>
                    <option value="📋">📋 إعلان</option>
                    <option value="🎉">🎉 مناسبة</option>
                    <option value="⏰">⏰ تذكير</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={isSavingAlert} style={{ width: '100%', padding: '12px', background: '#8B1A1A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, fontFamily: 'Cairo', cursor: isSavingAlert ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                {isSavingAlert ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> جاري الحفظ...</> : 'نشر التنبيه'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
