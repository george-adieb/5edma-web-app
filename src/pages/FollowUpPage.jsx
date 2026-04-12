import { useState } from 'react';
import { Phone, Home, MessageSquare, Save, CheckCircle, Bell } from 'lucide-react';
import { followUps, followUpLogs } from '../data/mockData';

const CONTACT_TYPES = [
  { key: 'مكالمة', label: 'مكالمة', Icon: Phone,         sel: { background: '#1D4ED8', color: 'white', borderColor: '#1D4ED8' } },
  { key: 'زيارة',  label: 'زيارة',  Icon: Home,          sel: { background: '#8B1A1A', color: 'white', borderColor: '#8B1A1A' } },
  { key: 'رسالة',  label: 'رسالة',  Icon: MessageSquare, sel: { background: '#7C3AED', color: 'white', borderColor: '#7C3AED' } },
];

const URGENCY = {
  urgent: { label: 'عاجل',   bg: '#FEE2E2', color: '#DC2626' },
  normal: { label: 'قريباً', bg: '#FEF9C3', color: '#D97706' },
};

const LOG_TYPE_COLORS = {
  مكالمة: { bg: '#DBEAFE', color: '#1D4ED8' },
  زيارة:  { bg: '#FEF9C3', color: '#B45309' },
  رسالة:  { bg: '#F3E8FF', color: '#7C3AED' },
};

export default function FollowUpPage() {
  const [selected, setSelected] = useState(followUps[0] ?? null);
  const [type,     setType]     = useState('مكالمة');
  const [status,   setStatus]   = useState('يحتاج متابعة');
  const [notes,    setNotes]    = useState('');
  const [saved,    setSaved]    = useState(false);
  const [logs,     setLogs]     = useState(followUpLogs);

  function handleSave() {
    if (!notes.trim()) return;
    setLogs(prev => [{ id: prev.length + 1, studentName: selected.studentName, time: 'الآن', type, notes }, ...prev]);
    setNotes('');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const selectStyle = {
    width: '100%', padding: '9px 14px',
    border: '1.5px solid #E5E7EB', borderRadius: '8px',
    fontFamily: 'Cairo, sans-serif', fontSize: '13px',
    color: '#374151', direction: 'rtl', outline: 'none', background: 'white',
    cursor: 'pointer', minHeight: '42px',
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ textAlign: 'right', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>متابعة الافتقاد</h1>
        <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>رعاية النفوس هي جوهر الخدمة</p>
      </div>

      {/* Two panels — stacks on mobile */}
      <div className="grid-half" style={{ marginBottom: '20px' }}>

        {/* Form panel */}
        <div style={{
          background: 'white', borderRadius: '14px', padding: '20px',
          border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ textAlign: 'right', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>تسجيل افتقاد جديد</h2>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '3px' }}>أدخل تفاصيل التواصل الأخير</p>
          </div>

          {/* Student select */}
          <div style={{ marginBottom: '14px', textAlign: 'right' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>الطالب</label>
            <select style={selectStyle} value={selected?.id ?? ''}
              onChange={e => { const f = followUps.find(x => x.id === parseInt(e.target.value)); if (f) setSelected(f); }}>
              {followUps.map(f => <option key={f.id} value={f.id}>{f.studentName}</option>)}
            </select>
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

          {/* Status */}
          <div style={{ marginBottom: '14px', textAlign: 'right' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>تحديث الحالة</label>
            <select style={selectStyle} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="يحتاج متابعة">يحتاج متابعة</option>
              <option value="تم التواصل">تم التواصل بنجاح</option>
              <option value="منتظم">عاد للانتظام</option>
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

          {/* Save */}
          {saved ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A', fontSize: '13px', fontWeight: 700 }}>
              <CheckCircle size={16} /> تم حفظ التقرير بنجاح!
            </div>
          ) : (
            <button onClick={handleSave} disabled={!notes.trim()} style={{
              width: '100%', padding: '13px', borderRadius: '10px', minHeight: '48px',
              background: notes.trim() ? 'linear-gradient(135deg, #8B1A1A, #B52626)' : '#D1D5DB',
              color: 'white', fontFamily: 'Cairo, sans-serif', fontWeight: 700,
              fontSize: '14px', border: 'none', cursor: notes.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <Save size={16} />
              حفظ التقرير
            </button>
          )}
        </div>

        {/* List panel */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <button style={{ fontSize: '12px', fontWeight: 700, color: '#8B1A1A', background: 'none', border: 'none', cursor: 'pointer' }}>
              تصفية ↓
            </button>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>قائمة المتابعة</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {followUps.map(f => {
              const urg   = URGENCY[f.urgency] || URGENCY.normal;
              const typeC = LOG_TYPE_COLORS[f.type] || {};
              return (
                <div key={f.id}
                  onClick={() => setSelected(f)}
                  style={{
                    background: 'white', borderRadius: '12px', padding: '14px 16px',
                    border: `1.5px solid ${selected?.id === f.id ? '#8B1A1A' : '#F3F4F6'}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '20px', fontWeight: 700, background: urg.bg, color: urg.color }}>
                        {urg.label}
                      </span>
                      {f.type && (
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: typeC.bg || '#F3F4F6', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', color: typeC.color || '#6B7280',
                        }}>
                          {f.type === 'مكالمة' ? <Phone size={14} /> : f.type === 'زيارة' ? <Home size={14} /> : <MessageSquare size={14} />}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{f.studentName}</p>
                        <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{f.grade}</p>
                        <p style={{ fontSize: '11px', marginTop: '2px', color: f.urgency === 'urgent' ? '#DC2626' : '#D97706', fontWeight: 600 }}>{f.absenceDuration}</p>
                      </div>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                        background: f.avatarColor, color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700,
                      }}>{f.avatar}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #F3F4F6' }}>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'right' }}>آخر تواصل: {f.lastContact}</p>
                  </div>
                </div>
              );
            })}

            {/* Reminder alert */}
            <div style={{
              background: '#FFFBEB', borderRadius: '10px', padding: '12px 14px',
              border: '1.5px solid #FDE68A', display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <Bell size={18} style={{ color: '#D97706', flexShrink: 0 }} />
              <div style={{ flex: 1, textAlign: 'right' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>تنبيه لمكالمة قادمة</p>
                <p style={{ fontSize: '11px', color: '#B45309', marginTop: '2px' }}>
                  غداً: تواصل مع أسرة {followUps[0]?.studentName ?? '—'}
                </p>
              </div>
              <span style={{ fontSize: '18px' }}>🕐</span>
            </div>
          </div>
        </div>
      </div>

      {/* Last 5 follow-up logs */}
      <div style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', textAlign: 'right', marginBottom: '14px' }}>
          آخر 5 عمليات افتقاد
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {logs.slice(0, 5).map(log => {
            const t = LOG_TYPE_COLORS[log.type] || { bg: '#F3F4F6', color: '#6B7280' };
            return (
              <div key={log.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.color, marginTop: '6px', flexShrink: 0 }} />
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{log.time}</span>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{log.studentName}</p>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.5, marginTop: '2px' }}>{log.notes}</p>
                </div>
              </div>
            );
          })}
        </div>
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
