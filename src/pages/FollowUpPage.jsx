import { useState, useEffect, useMemo } from 'react';
import { Phone, Home, MessageSquare, Save, CheckCircle, Bell, Loader2, AlertCircle } from 'lucide-react';
import {
  fetchFollowUpCandidates,
  fetchFollowUpLogs,
  saveFollowUpLog,
  updateStudentStatus,
} from '../lib/database';
import { getRecentFridays } from '../lib/attendanceCycle';

/* ─── Constants ──────────────────────────────────────────────── */

const CONTACT_TYPES = [
  { key: 'مكالمة', label: 'مكالمة', Icon: Phone,         sel: { background: '#1D4ED8', color: 'white', borderColor: '#1D4ED8' } },
  { key: 'زيارة',  label: 'زيارة',  Icon: Home,          sel: { background: '#8B1A1A', color: 'white', borderColor: '#8B1A1A' } },
  { key: 'رسالة',  label: 'رسالة',  Icon: MessageSquare, sel: { background: '#7C3AED', color: 'white', borderColor: '#7C3AED' } },
];

// Priority levels — driven by consecutive Friday absence count
// consecutive >= 3 → urgent | == 2 → high | == 1 → normal
const URGENCY = {
  urgent: { label: 'عاجل',    bg: '#FEE2E2', color: '#DC2626' }, // 3+ Fridays
  high:   { label: 'مهم',     bg: '#FEF3C7', color: '#D97706' }, // 2 Fridays
  normal: { label: 'متابعة',  bg: '#EEF2FF', color: '#4F46E5' }, // 1 Friday
};

/** Derive urgency key from consecutive absence count. */
function urgencyLevel(consecutive) {
  if (consecutive >= 3) return 'urgent';
  if (consecutive === 2) return 'high';
  return 'normal';
}

/** Human-readable Arabic absence duration. */
function absenceDurationLabel(consecutive, total) {
  if (consecutive >= 3) return `غياب ${consecutive} أسابيع متتالية`;
  if (consecutive === 2) return 'غياب أسبوعين متتاليين';
  if (consecutive === 1) return 'غياب أسبوع واحد';
  // Fallback: no consecutive streak but has total absences (scattered)
  if (total === 1) return 'غياب غير متتالي (أسبوع)';
  return `${total} غيابات متفرقة`;
}

// How many recent Fridays to look back when building the follow-up list
const LOOKBACK_WEEKS = 8;

const LOG_TYPE_COLORS = {
  مكالمة: { bg: '#DBEAFE', color: '#1D4ED8' },
  زيارة:  { bg: '#FEF9C3', color: '#B45309' },
  رسالة:  { bg: '#F3E8FF', color: '#7C3AED' },
};

const SELECT_STYLE = {
  width: '100%', padding: '9px 14px',
  border: '1.5px solid #E5E7EB', borderRadius: '8px',
  fontFamily: 'Cairo, sans-serif', fontSize: '13px',
  color: '#374151', direction: 'rtl', outline: 'none', background: 'white',
  cursor: 'pointer', minHeight: '42px',
};

/* ─── Skeleton block ─────────────────────────────────────────── */
function Skel({ w = '100%', h = '14px', radius = '6px' }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function FollowUpPage() {

  // ── Data state ─────────────────────────────────────────────
  const [followUpStudents, setFollowUpStudents] = useState([]);
  const [logs,             setLogs]             = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [loadError,        setLoadError]        = useState(null);

  // ── Form state ─────────────────────────────────────────────
  const [selected,      setSelected]      = useState(null);
  const [type,          setType]          = useState('مكالمة');
  const [contactStatus, setContactStatus] = useState('يحتاج متابعة');
  const [notes,         setNotes]         = useState('');
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [saveError,     setSaveError]     = useState('');

  // ── Load ───────────────────────────────────────────────────
  async function loadData() {
    const recentFridays = getRecentFridays(LOOKBACK_WEEKS);
    const [studentsRes, logsRes] = await Promise.allSettled([
      fetchFollowUpCandidates(recentFridays),
      fetchFollowUpLogs(5),
    ]);

    if (studentsRes.status === 'fulfilled') {
      const studs = studentsRes.value;
      setFollowUpStudents(studs);
      setSelected(prev => {
        // keep current selection if it still exists; else pick first
        if (prev && studs.find(s => s.id === prev.id)) return prev;
        return studs[0] ?? null;
      });
    } else {
      console.error('[FollowUp] students load error', studentsRes.reason);
      setLoadError('تعذّر تحميل قائمة المتابعة.');
    }

    if (logsRes.status === 'fulfilled') {
      setLogs(logsRes.value);
    } else {
      console.error('[FollowUp] logs load error', logsRes.reason);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadData().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Build last-contact map: student_id → most recent log ──
  // Used only for display ("آخر تواصل") — urgency is now
  // calculated from attendance data, not from this map.
  const lastContactMap = useMemo(() => {
    const map = {};
    for (const log of logs) {
      if (log.student_id && !map[log.student_id]) {
        map[log.student_id] = { type: log.type, time: log.time };
      }
    }
    return map;
  }, [logs]);

  // ── Save handler ───────────────────────────────────────────
  async function handleSave() {
    if (!notes.trim() || !selected || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await saveFollowUpLog({
        studentId:     selected.id,
        studentName:   selected.name,
        type,
        notes,
        contactStatus,
      });

      // If servant marks student as returned to regularity → update their status
      if (contactStatus === 'عاد للانتظام') {
        await updateStudentStatus(selected.id, 'منتظم');
      }

      // Reload both lists so UI reflects the save
      await loadData();

      setNotes('');
      setContactStatus('يحتاج متابعة');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('[FollowUp] save error', err);
      setSaveError('تعذّر حفظ التقرير. يرجى المحاولة مرة أخرى.');
      setTimeout(() => setSaveError(''), 4000);
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* Header */}
      <div style={{ textAlign: 'right', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>متابعة الافتقاد</h1>
        <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>رعاية النفوس هي جوهر الخدمة</p>
      </div>

      {/* Load error banner */}
      {loadError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end',
          background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: '10px',
          padding: '10px 14px', marginBottom: '16px',
          fontSize: '12px', fontWeight: 700, color: '#D97706',
        }}>
          <span>{loadError}</span>
          <AlertCircle size={14} />
        </div>
      )}

      {/* Two panels */}
      <div className="grid-half" style={{ marginBottom: '20px' }}>

        {/* ── Form panel ─────────────────────────────────────── */}
        <div style={{
          background: 'white', borderRadius: '14px', padding: '20px',
          border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ textAlign: 'right', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>تسجيل افتقاد جديد</h2>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '3px' }}>أدخل تفاصيل التواصل الأخير</p>
          </div>

          {/* Student selector */}
          <div style={{ marginBottom: '14px', textAlign: 'right' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>الطالب</label>
            {loading ? (
              <Skel h="42px" radius="8px" />
            ) : followUpStudents.length === 0 ? (
              <div style={{
                padding: '10px 14px', background: '#F0FDF4', borderRadius: '8px',
                border: '1.5px solid #86EFAC', fontSize: '13px', color: '#16A34A',
                fontWeight: 700, textAlign: 'right',
              }}>
                🎉 لا يوجد طلاب يحتاجون افتقاداً الآن
              </div>
            ) : (
              <select
                style={SELECT_STYLE}
                value={selected?.id ?? ''}
                onChange={e => {
                  const found = followUpStudents.find(s => String(s.id) === e.target.value);
                  if (found) setSelected(found);
                }}
              >
                {followUpStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.grade || '—'}</option>
                ))}
              </select>
            )}
          </div>

          {/* Contact type */}
          <div style={{ marginBottom: '14px', textAlign: 'right' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>نوع التواصل</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {CONTACT_TYPES.map(ct => {
                const Icon     = ct.Icon;
                const isActive = type === ct.key;
                return (
                  <button key={ct.key} onClick={() => setType(ct.key)} style={{
                    flex: 1, padding: '10px 6px', borderRadius: '10px',
                    border: `2px solid ${isActive ? ct.sel.borderColor : '#E5E7EB'}`,
                    cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
                    fontWeight: 700, fontSize: '12px', transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                    minHeight: '60px',
                    ...(isActive ? ct.sel : { background: 'white', color: '#6B7280' }),
                  }}>
                    <Icon size={18} />
                    {ct.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status update */}
          <div style={{ marginBottom: '14px', textAlign: 'right' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>تحديث الحالة</label>
            <select style={SELECT_STYLE} value={contactStatus} onChange={e => setContactStatus(e.target.value)}>
              <option value="يحتاج متابعة">يحتاج متابعة</option>
              <option value="تم التواصل">تم التواصل بنجاح</option>
              <option value="عاد للانتظام">عاد للانتظام</option>
            </select>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '16px', textAlign: 'right' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>ملاحظات الافتقاد</label>
            <textarea
              rows={4} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="اكتب تفاصيل الزيارة أو سبب الغياب هنا..."
              style={{
                width: '100%', padding: '10px 14px', resize: 'none',
                border: '1.5px solid #E5E7EB', borderRadius: '8px',
                fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#374151',
                direction: 'rtl', outline: 'none', background: 'white',
              }}
              onFocus={e => e.target.style.borderColor = '#8B1A1A'}
              onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Save error */}
          {saveError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end',
              marginBottom: '10px', padding: '8px 12px', borderRadius: '8px',
              background: '#FEF2F2', border: '1px solid #FECACA',
              fontSize: '12px', fontWeight: 700, color: '#DC2626',
            }}>
              <span>{saveError}</span>
              <AlertCircle size={13} />
            </div>
          )}

          {/* Save button / success */}
          {saved ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '6px', padding: '12px', borderRadius: '10px',
              background: '#DCFCE7', color: '#16A34A', fontSize: '13px', fontWeight: 700,
            }}>
              <CheckCircle size={16} /> تم حفظ التقرير بنجاح!
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={!notes.trim() || !selected || saving}
              style={{
                width: '100%', padding: '13px', borderRadius: '10px', minHeight: '48px',
                background: (notes.trim() && selected && !saving)
                  ? 'linear-gradient(135deg, #8B1A1A, #B52626)' : '#D1D5DB',
                color: 'white', fontFamily: 'Cairo, sans-serif', fontWeight: 700,
                fontSize: '14px', border: 'none',
                cursor: (notes.trim() && selected && !saving) ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'background 0.2s',
              }}
            >
              {saving
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> جارٍ الحفظ...</>
                : <><Save size={16} /> حفظ التقرير</>
              }
            </button>
          )}
        </div>

        {/* ── List panel ──────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#9CA3AF' }}>
              {loading ? '...' : `${followUpStudents.length} طالب`}
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>قائمة المتابعة</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Loading skeletons */}
            {loading && [0, 1, 2].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: '12px', padding: '14px 16px',
                border: '1.5px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skel w="60px" h="22px" radius="20px" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <Skel w="100px" h="14px" />
                      <div style={{ marginTop: '5px' }}><Skel w="70px" h="11px" /></div>
                    </div>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#F3F4F6', flexShrink: 0 }} />
                  </div>
                </div>
              </div>
            ))}

            {/* Real follow-up student cards — sorted by attendance-based priority */}
            {!loading && followUpStudents.map(f => {
              const level   = urgencyLevel(f.absenceConsecutive);
              const urg     = URGENCY[level];
              const lastLog = lastContactMap[f.id];
              const typeC   = lastLog ? (LOG_TYPE_COLORS[lastLog.type] || {}) : {};
              const durationText = absenceDurationLabel(f.absenceConsecutive, f.absenceTotal);

              return (
                <div
                  key={f.id}
                  onClick={() => setSelected(f)}
                  style={{
                    background: 'white', borderRadius: '12px', padding: '14px 16px',
                    border: `1.5px solid ${selected?.id === f.id ? '#8B1A1A' : '#F3F4F6'}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                    {/* Left column: urgency badge + last-contact type icon */}
                    <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{
                        fontSize: '11px', padding: '3px 9px', borderRadius: '20px',
                        fontWeight: 700, background: urg.bg, color: urg.color,
                      }}>
                        {urg.label}
                      </span>
                      {lastLog && (
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: typeC.bg || '#F3F4F6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: typeC.color || '#6B7280',
                        }}>
                          {lastLog.type === 'مكالمة' ? <Phone size={14} />
                            : lastLog.type === 'زيارة' ? <Home size={14} />
                            : <MessageSquare size={14} />}
                        </div>
                      )}
                    </div>

                    {/* Right column: avatar + name + grade + absence duration */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{f.name}</p>
                        <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{f.grade || '—'}</p>
                        <p style={{ fontSize: '11px', marginTop: '2px', color: urg.color, fontWeight: 600 }}>
                          {durationText}
                        </p>
                      </div>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                        background: f.avatar_color || '#8B1A1A', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700,
                      }}>
                        {f.avatar}
                      </div>
                    </div>
                  </div>

                  {/* Footer: last contact + absence count pill */}
                  <div style={{
                    marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #F3F4F6',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '20px',
                      background: '#F3F4F6', color: '#6B7280', fontWeight: 600,
                    }}>
                      {f.absenceTotal} {f.absenceTotal === 1 ? 'غياب' : 'غيابات'} / {LOOKBACK_WEEKS} أسابيع
                    </span>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'right' }}>
                      آخر تواصل: {lastLog ? `${lastLog.type} — ${lastLog.time}` : 'لم يتم التواصل'}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {!loading && followUpStudents.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '32px',
                background: 'white', borderRadius: '12px', border: '1.5px solid #F3F4F6',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <p style={{ fontSize: '28px', marginBottom: '8px' }}>🎉</p>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#16A34A' }}>ما شاء الله!</p>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>لا يوجد طلاب يحتاجون متابعة حالياً</p>
              </div>
            )}

            {/* Reminder alert — shown only when there are students to follow up */}
            {!loading && followUpStudents.length > 0 && (
              <div style={{
                background: '#FFFBEB', borderRadius: '10px', padding: '12px 14px',
                border: '1.5px solid #FDE68A',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <Bell size={18} style={{ color: '#D97706', flexShrink: 0 }} />
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>تنبيه لمكالمة قادمة</p>
                  <p style={{ fontSize: '11px', color: '#B45309', marginTop: '2px' }}>
                    الأولوية: تواصل مع أسرة {followUpStudents[0]?.name ?? '—'}
                  </p>
                </div>
                <span style={{ fontSize: '18px' }}>🕐</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Last 5 follow-up logs ─────────────────────────────── */}
      <div style={{
        background: 'white', borderRadius: '14px', padding: '20px',
        border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', textAlign: 'right', marginBottom: '14px' }}>
          آخر 5 عمليات افتقاد
        </h3>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E5E7EB', marginTop: '6px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <Skel w="60px" h="11px" />
                    <Skel w="90px" h="14px" />
                  </div>
                  <Skel w="80%" h="12px" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Real logs */}
        {!loading && logs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {logs.slice(0, 5).map(log => {
              const t = LOG_TYPE_COLORS[log.type] || { bg: '#F3F4F6', color: '#6B7280' };
              return (
                <div key={log.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: t.color, marginTop: '6px', flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{log.time}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                          {log.student_name}
                        </p>
                        <span style={{
                          fontSize: '10px', padding: '2px 7px', borderRadius: '20px',
                          fontWeight: 700, background: t.bg, color: t.color,
                        }}>
                          {log.type}
                        </span>
                      </div>
                    </div>
                    {log.notes && (
                      <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.5, marginTop: '2px' }}>
                        {log.notes}
                      </p>
                    )}
                    {log.servant_name && (
                      <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '3px' }}>
                        {log.servant_name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty log state */}
        {!loading && logs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ fontSize: '22px', marginBottom: '6px' }}>📋</p>
            <p style={{ fontSize: '13px', color: '#9CA3AF' }}>لم يتم تسجيل أي افتقاد بعد</p>
          </div>
        )}

        <button style={{
          display: 'block', width: '100%', textAlign: 'center',
          marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F3F4F6',
          fontSize: '13px', fontWeight: 700, color: '#8B1A1A',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
        }}>
          عرض كل السجل
        </button>
      </div>
    </div>
  );
}
