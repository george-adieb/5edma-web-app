import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Share2, Edit3, Plus, Heart, Loader2 } from 'lucide-react';
import {
  fetchStudent,
  fetchStudentAttendance,
  fetchFollowUpLogs,
  fetchFollowUpByStudentId,
} from '../lib/database';

const ATT_STYLE = {
  حاضر:  { bg: '#DCFCE7', color: '#16A34A', label: '✓' },
  غائب:  { bg: '#FEE2E2', color: '#DC2626', label: '✗' },
  معتذر: { bg: '#FEF9C3', color: '#D97706', label: '~' },
};

const FU_TYPE = {
  مكالمة: { bg: '#DBEAFE', color: '#1D4ED8', icon: '📞' },
  زيارة:  { bg: '#FEF9C3', color: '#B45309', icon: '🏠' },
  رسالة:  { bg: '#F3E8FF', color: '#7C3AED', icon: '💬' },
};

const STATUS_BADGE = {
  منتظم:            { bg: '#DCFCE7', color: '#16A34A' },
  جديد:             { bg: '#DBEAFE', color: '#1D4ED8' },
  'يحتاج افتقاد':  { bg: '#FEE2E2', color: '#DC2626' },
};

export default function StudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [student,          setStudent]          = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [followUpLogs,     setFollowUpLogs]     = useState([]);
  const [followUp,         setFollowUp]         = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchStudent(id),
      fetchStudentAttendance(id),
      fetchFollowUpLogs(20, id),
      fetchFollowUpByStudentId(id),
    ])
      .then(([stud, history, logs, fu]) => {
        setStudent(stud);
        setAttendanceHistory(history);
        setFollowUpLogs(logs);
        setFollowUp(fu);
      })
      .catch(err => {
        console.error('Profile load error:', err);
        setError('تعذّر تحميل بيانات الطالب');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px', gap: '10px' }}>
      <Loader2 size={26} style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} />
      <p style={{ fontSize: '14px', color: '#9CA3AF' }}>جارٍ تحميل ملف الطالب...</p>
    </div>
  );

  // ── Error / Not found ────────────────────────────────────────────────────────
  if (error || !student) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <p style={{ fontSize: '36px', marginBottom: '12px' }}>{error ? '⚠️' : '😕'}</p>
      <p style={{ fontSize: '16px', fontWeight: 700, color: '#374151' }}>
        {error || 'الطالب غير موجود'}
      </p>
      <button
        onClick={() => navigate('/students')}
        style={{
          marginTop: '16px', padding: '10px 24px', borderRadius: '9px',
          background: '#8B1A1A', color: 'white', border: 'none',
          fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
        }}
      >
        العودة للقائمة
      </button>
    </div>
  );

  // ── Derived values ───────────────────────────────────────────────────────────
  const badge          = STATUS_BADGE[student.status] || { bg: '#F3F4F6', color: '#6B7280' };
  const avatarColor    = student.avatar_color || '#8B1A1A';
  const attendanceRate = student.attendance_rate ?? 0;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#8B1A1A' }}>ملف الطالب</span>
        <span style={{ color: '#D1D5DB', fontSize: '13px' }}>‹</span>
        <button
          onClick={() => navigate('/students')}
          style={{ fontSize: '13px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}
        >
          الطلاب
        </button>
      </div>

      {/* Profile header card */}
      <div style={{
        background: 'white', borderRadius: '14px', padding: '24px',
        marginBottom: '16px', border: '1px solid #F3F4F6',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {/* Actions (left) */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{
              width: '36px', height: '36px', borderRadius: '9px',
              border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280',
            }}><Share2 size={15} /></button>
            <button style={{
              width: '36px', height: '36px', borderRadius: '9px',
              border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280',
            }}><Edit3 size={15} /></button>
          </div>

          {/* Info (right) */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: '6px',
                border: `1.5px solid ${badge.color}`, color: badge.color,
                fontSize: '12px', fontWeight: 700, marginBottom: '8px',
              }}>{student.status}</span>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#111827', marginBottom: '10px', lineHeight: 1.2 }}>
                {student.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '13px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🎓 {student.grade || student.grade_id || '—'}
                </span>
                <a
                  href={`tel:${student.parent_phone}`}
                  style={{ fontSize: '13px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                >
                  📞 {student.parent_phone || '—'}
                </a>
                <span style={{ fontSize: '13px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🎂 {student.birth_date || '—'}
                </span>
                <span style={{
                  padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                  background: '#FEF2F2', color: '#8B1A1A',
                }}>🔰 قيد الخدمة</span>
              </div>
            </div>
            {/* Avatar */}
            <div style={{
              width: '68px', height: '68px', borderRadius: '14px', flexShrink: 0,
              background: avatarColor, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 900,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>{student.avatar}</div>
          </div>
        </div>
      </div>

      {/* Main content: 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* LEFT: attendance + notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Attendance history */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '18px 20px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <button style={{ fontSize: '12px', fontWeight: 700, color: '#8B1A1A', background: 'none', border: 'none', cursor: 'pointer' }}>
                عرض السجل الكامل ›
              </button>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>سجل الحضور الأخير</h3>
            </div>
            {attendanceHistory.length > 0 ? (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {attendanceHistory.map((rec, i) => {
                  const s = ATT_STYLE[rec.status] || { bg: '#F3F4F6', color: '#6B7280', label: '?' };
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        background: s.bg, color: s.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 700,
                      }}>{s.label}</div>
                      <p style={{ fontSize: '10px', color: '#9CA3AF', textAlign: 'center', maxWidth: '42px' }}>
                        {rec.date.split(' ').slice(0, 2).join(' ')}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', padding: '12px' }}>لا يوجد سجل حضور</p>
            )}
          </div>

          {/* Follow-up / servant notes */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '18px 20px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '7px 14px', borderRadius: '8px',
                background: '#8B1A1A', color: 'white', border: 'none',
                fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
              }}><Plus size={13} />إضافة ملاحظة</button>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>ملاحظات الخادم</h3>
                <p style={{ fontSize: '11px', color: '#9CA3AF' }}>التاريخ الرعوي وتطور الحالة الروحية</p>
              </div>
            </div>

            {followUpLogs.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', padding: '16px' }}>لا توجد ملاحظات</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {followUpLogs.map((log, i) => {
                  const t = FU_TYPE[log.type] || { bg: '#F3F4F6', color: '#6B7280', icon: '📝' };
                  return (
                    <div key={i} style={{
                      background: '#F9FAFB', borderRadius: '10px',
                      padding: '12px 14px', textAlign: 'right',
                      border: '1px solid #F3F4F6',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{log.time}</span>
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                          background: t.bg, color: t.color, fontWeight: 700,
                        }}>{t.icon} {log.type}</span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>{log.notes}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>
                        الخادم: {log.servant_name || log.recorded_by || '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active follow-up task (if any) */}
          {followUp && (
            <div style={{
              background: followUp.urgency === 'urgent' ? '#FEF2F2' : '#FFFBEB',
              borderRadius: '12px', padding: '16px 20px',
              border: `1.5px solid ${followUp.urgency === 'urgent' ? '#FECACA' : '#FDE68A'}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              textAlign: 'right',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 700,
                  background: followUp.urgency === 'urgent' ? '#DC2626' : '#D97706',
                  color: 'white',
                }}>
                  {followUp.urgency === 'urgent' ? '🔴 عاجل' : '🟡 عادي'}
                </span>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>حالة الافتقاد</h3>
              </div>
              <p style={{ fontSize: '13px', color: '#374151' }}>{followUp.absence_duration}</p>
              {followUp.last_contact && (
                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                  آخر تواصل: {followUp.last_contact}
                </p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: stats + info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Attendance rate */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '18px 20px',
            border: '1.5px solid #FECACA', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            textAlign: 'right',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>
              نسبة الحضور السنوية
            </h3>
            <p style={{ fontSize: '42px', fontWeight: 900, color: '#8B1A1A', lineHeight: 1, marginBottom: '8px' }}>
              {attendanceRate}%
            </p>
            <div style={{ width: '100%', height: '8px', background: '#F3F4F6', borderRadius: '4px', marginBottom: '8px' }}>
              <div style={{
                height: '8px', borderRadius: '4px',
                width: `${attendanceRate}%`,
                background: 'linear-gradient(90deg, #8B1A1A, #C9A84C)',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                background: attendanceRate >= 80 ? '#DCFCE7' : attendanceRate >= 50 ? '#FEF9C3' : '#FEE2E2',
                color: attendanceRate >= 80 ? '#16A34A' : attendanceRate >= 50 ? '#D97706' : '#DC2626',
                fontWeight: 700,
              }}>
                {attendanceRate >= 80 ? 'متفوق' : attendanceRate >= 50 ? 'مقبول' : 'يحتاج متابعة'}
              </span>
              <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
                {student.last_attendance ? `آخر حضور: ${student.last_attendance}` : 'لم يحضر بعد'}
              </p>
            </div>
          </div>

          {/* Medical info */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 18px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            textAlign: 'right',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>معلومات طبية</h3>
              <span>🛡️</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{student.blood_type || '—'}</span>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>فصيلة الدم</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{student.medical_notes || 'لا يوجد'}</span>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>حساسية</span>
              </div>
            </div>
          </div>

          {/* Hobbies */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 18px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            textAlign: 'right',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>المواهب والاهتمامات</h3>
              <span>🌟</span>
            </div>
            {student.hobbies && student.hobbies.length > 0 ? (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {student.hobbies.map((h, i) => (
                  <span key={i} style={{
                    padding: '5px 12px', borderRadius: '20px',
                    background: '#FEF2F2', color: '#8B1A1A',
                    fontSize: '12px', fontWeight: 600,
                  }}>{h}</span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#9CA3AF' }}>لا يوجد</p>
            )}
          </div>

          {/* Quick actions */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 18px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            textAlign: 'right',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>إجراءات سريعة</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a
                href={`tel:${student.parent_phone}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
                  padding: '10px 14px', borderRadius: '9px',
                  background: '#F0FDF4', color: '#16A34A', textDecoration: 'none',
                  fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700,
                }}
              >
                اتصال بولي الأمر <Phone size={15} />
              </a>
              <button
                onClick={() => navigate('/followup')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
                  padding: '10px 14px', borderRadius: '9px',
                  background: '#FEF2F2', color: '#8B1A1A',
                  fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700,
                  border: 'none', cursor: 'pointer', width: '100%',
                }}
              >
                تسجيل افتقاد <Heart size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
