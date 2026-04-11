import { useNavigate } from 'react-router-dom';
import { Phone, Save } from 'lucide-react';
import { dashboardStats, absentToday, alerts, students } from '../data/mockData';

const S = {
  card: {
    background: 'white',
    borderRadius: '14px',
    padding: '20px',
    border: '1px solid #F3F4F6',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
};

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', direction: 'rtl' }}>
      {/* Page Title */}
      <div style={{ textAlign: 'right', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>لوحة التحكم</h1>
        <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
          مرحباً بك مجدداً. إليك ملخص نشاط الخدمة لهذا اليوم.
        </p>
      </div>

      {/* ── Row 1: Three stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>

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
            }}>‹ التفاصيل</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px' }}>حضور اليوم</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: 'flex-start' }}>
              <span style={{ fontSize: '40px', fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                {dashboardStats.presentToday}
              </span>
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>/ {dashboardStats.totalStudents} طالب</span>
            </div>
          </div>
          {/* Mini avatars */}
          <div style={{ display: 'flex', gap: '-4px', marginTop: '12px', justifyContent: 'flex-start' }}>
            {students.slice(0, 4).map((s, i) => (
              <div key={s.id} style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: s.avatarColor, border: '2px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', color: 'white', fontWeight: 700,
                marginRight: i > 0 ? '-8px' : '0', position: 'relative', zIndex: 4 - i,
              }}>
                {s.avatar.charAt(0)}
              </div>
            ))}
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: '#E5E7EB', border: '2px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', color: '#6B7280', fontWeight: 700, marginRight: '-8px', zIndex: 0,
            }}>
              {dashboardStats.totalStudents - 4}+
            </div>
          </div>
        </div>

        {/* حالات غياب */}
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
            <p style={{ fontSize: '40px', fontWeight: 900, color: '#DC2626', lineHeight: 1 }}>
              {String(dashboardStats.absentToday).padStart(2, '0')}
            </p>
          </div>
        </div>

        {/* محتاجين افتقاد */}
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
            <p style={{ fontSize: '40px', fontWeight: 900, color: '#D97706', lineHeight: 1 }}>
              {String(dashboardStats.needFollowUp).padStart(2, '0')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 2: Follow-up waiting + Alerts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px' }}>

        {/* بانتظار الافتقاد – table */}
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
              style={{
                fontSize: '12px', fontWeight: 700, color: '#8B1A1A',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >مشاهدة الكل</button>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1.5fr',
            gap: '8px', padding: '8px 12px',
            background: '#FAFAFA', borderRadius: '8px', marginBottom: '6px',
          }}>
            {['اسم الطالب','مدة الغياب','آخر تواصل','إجراء'].map(h => (
              <p key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textAlign: 'right' }}>{h}</p>
            ))}
          </div>

          {/* Rows */}
          {absentToday.map((student, i) => {
            const durations = ['٣ أسابيع متتالية', 'أسبوع واحد', 'أسبوعين'];
            const contacts = ['لم يتم التواصل', 'الأسبوع الماضي', 'منذ ١٤ يوم'];
            return (
              <div key={student.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1.5fr',
                gap: '8px', padding: '10px 12px', alignItems: 'center',
                borderBottom: '1px solid #F9FAFB',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: student.avatarColor, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700,
                  }}>{student.avatar}</div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{student.name}</p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{student.grade}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '11px', padding: '3px 8px', borderRadius: '20px',
                    background: i === 0 ? '#FEE2E2' : '#FEF9C3',
                    color: i === 0 ? '#DC2626' : '#D97706', fontWeight: 600,
                  }}>{durations[i] || 'أسبوع'}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#6B7280', textAlign: 'right' }}>
                  {contacts[i] || '—'}
                </p>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-start' }}>
                  <button
                    onClick={() => navigate(`/students/${student.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '5px 10px', borderRadius: '7px',
                      background: '#8B1A1A', color: 'white',
                      border: 'none', cursor: 'pointer',
                      fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: 700,
                    }}>
                    <Save size={11} />إضافة ملاحظة
                  </button>
                  <a href={`tel:${student.parentPhone}`} style={{
                    width: '30px', height: '30px', borderRadius: '7px',
                    border: '1.5px solid #E5E7EB', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#6B7280', textDecoration: 'none',
                    background: 'white',
                  }}>
                    <Phone size={13} />
                  </a>
                </div>
              </div>
            );
          })}

          {absentToday.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <p style={{ fontSize: '24px', marginBottom: '8px' }}>🎉</p>
              <p style={{ fontSize: '13px', color: '#6B7280' }}>لا يوجد غائبون اليوم</p>
            </div>
          )}
        </div>

        {/* تنبيهات هامة – dark red card */}
        <div style={{
          background: 'linear-gradient(160deg, #8B1A1A 0%, #6B1414 100%)',
          borderRadius: '14px', padding: '20px',
          boxShadow: '0 4px 16px rgba(139,26,26,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', marginBottom: '16px' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', marginBottom: '4px' }}>
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


