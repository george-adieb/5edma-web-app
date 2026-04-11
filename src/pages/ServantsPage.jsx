import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Loader2, UserPlus } from 'lucide-react';
import { servantRoles, servantStages, servants as mockServants } from '../data/mockData';

const STATUS_BADGE = {
  'نشط':       { bg: '#DCFCE7', color: '#16A34A', dot: '#16A34A' },
  'غير نشط':   { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' },
};

// RTL grid: 5 columns — servant(wide) · role · stage · status · actions
const COLS = '2.5fr 1.5fr 1.5fr 1fr 1fr';

export default function ServantsPage() {
  const navigate = useNavigate();
  const [servants, setServants] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  
  const [search,   setSearch]   = useState('');
  const [stage,    setStage]    = useState('all');
  const [role,     setRole]     = useState('all');
  const [page,     setPage]     = useState(1);
  const PER = 8;

  useEffect(() => {
    // Simulate Supabase fetch latency
    setLoading(true);
    setTimeout(() => {
      setServants(mockServants);
      setLoading(false);
    }, 600);
  }, []);

  const filtered = servants.filter(s => {
    const q  = s.name.includes(search) || (s.email || '').includes(search);
    const r  = role === 'all' || s.role === role;
    const st = stage === 'all' || s.stage === stage;
    return q && r && st;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const visible    = filtered.slice((page - 1) * PER, page * PER);

  const pillBtn = (active, onClick, label) => (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
      fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12.5px', border: 'none',
      background: active ? '#8B1A1A' : '#F3F4F6',
      color:      active ? 'white'   : '#6B7280',
      transition: 'all 0.15s',
    }}>{label}</button>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', direction: 'rtl' }}>

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '10px' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} />
          <p style={{ fontSize: '14px', color: '#9CA3AF' }}>جارٍ تحميل الخدام...</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────── */}
      {!loading && error && (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</p>
          <p style={{ fontSize: '14px', color: '#DC2626', fontWeight: 700 }}>{error}</p>
          <button
            onClick={() => {
              setError(null); setLoading(true);
              setTimeout(() => { setServants(mockServants); setLoading(false); }, 600);
            }}
            style={{ marginTop: '12px', padding: '8px 20px', borderRadius: '8px', background: '#8B1A1A', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}
          >إعادة المحاولة</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Page header ─────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>قائمة الخدام</h1>
              <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
                إدارة وتفاصيل خدام الخدمة والاجتماعات
              </p>
            </div>
            
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: '10px',
                background: '#8B1A1A', color: 'white',
                border: 'none', cursor: 'pointer',
                fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px',
                boxShadow: '0 4px 12px rgba(139,26,26,0.2)',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <UserPlus size={16} />
              إضافة خادم جديد
            </button>
          </div>

          {/* ── Filter bar ──────────────────────────────────────── */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '14px 16px',
            marginBottom: '14px', border: '1px solid #F3F4F6',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            {/* Top row: total count + search */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              {/* Total (right side in RTL) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>من {servants.length} خدام</span>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#111827' }}>{filtered.length}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#9CA3AF' }}>إجمالي الخدام</span>
              </div>
              {/* Search */}
              <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
                <svg
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }}
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  placeholder="ابحث بالاسم أو البريد..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  style={{
                    width: '100%', padding: '8px 34px 8px 12px',
                    background: '#F9FAFB', border: '1.5px solid #F3F4F6',
                    borderRadius: '8px', fontFamily: 'Cairo, sans-serif',
                    fontSize: '13px', color: '#374151', direction: 'rtl', outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Stage pills */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', width: '100px' }}>تصفية حسب المرحلة</span>
              {servantStages.map(c => <span key={c.id}>{pillBtn(stage === c.id, () => { setStage(c.id); setPage(1); }, c.label)}</span>)}
            </div>

            {/* Role pills */}
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', width: '100px' }}>تصفية حسب الدور</span>
              {servantRoles.map(r => <span key={r.id}>{pillBtn(role === r.id, () => { setRole(r.id); setPage(1); }, r.label)}</span>)}
            </div>
          </div>

          {/* ── Table ───────────────────────────────────────────── */}
          <div style={{
            background: 'white', borderRadius: '12px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: COLS,
              padding: '10px 16px', background: '#FAFAFA',
              borderBottom: '1.5px solid #F3F4F6',
              direction: 'rtl',
            }}>
              {['الاسم', 'الدور', 'المرحلة', 'الحالة', 'الإجراءات'].map((h, i) => (
                <p key={h} style={{
                  fontSize: '11px', fontWeight: 700, color: '#9CA3AF',
                  textAlign: i === 0 ? 'right' : 'center',
                }}>{h}</p>
              ))}
            </div>

            {/* Empty state */}
            {visible.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <p style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</p>
                <p style={{ fontSize: '13px', color: '#6B7280' }}>لا توجد نتائج مطابقة</p>
              </div>
            )}

            {/* Rows */}
            {visible.map(s => {
              const badge = STATUS_BADGE[s.status] || { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' };
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'grid', gridTemplateColumns: COLS,
                    padding: '13px 16px', alignItems: 'center',
                    borderBottom: '1px solid #FAFAFA', cursor: 'pointer',
                    transition: 'background 0.1s',
                    direction: 'rtl',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  {/* Col 1 — الاسم: avatar + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                      background: s.avatarColor || '#8B1A1A', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700,
                    }}>{s.avatar}</div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{s.name}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>
                        {s.email || s.phone || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Col 2 — الدور */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                     <span style={{ 
                        fontSize: '11.5px', fontWeight: 700, color: '#8B1A1A', 
                        background: '#FEF2F2', padding: '4px 10px', borderRadius: '14px' 
                     }}>
                        {s.role}
                     </span>
                  </div>

                  {/* Col 3 — المرحلة */}
                  <p style={{ fontSize: '12.5px', color: '#374151', textAlign: 'center', fontWeight: 600 }}>
                    {s.stage || '—'}
                  </p>

                  {/* Col 4 — الحالة */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 10px', borderRadius: '20px',
                      fontSize: '11px', fontWeight: 700,
                      background: badge.bg, color: badge.color,
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: badge.dot, flexShrink: 0 }} />
                      {s.status}
                    </span>
                  </div>

                  {/* Col 5 — الإجراءات */}
                  <div style={{ display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                    <button style={{
                      padding: '5px 12px', borderRadius: '6px', background: 'white',
                      border: '1px solid #E5E7EB', cursor: 'pointer', color: '#374151',
                      fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: 700,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                    >
                      عرض التفاصيل
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Pagination footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA',
              direction: 'rtl',
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(n => (
                  <button key={`page-${n}`} onClick={() => setPage(n)} style={{
                    width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px',
                    border: '1px solid #E5E7EB',
                    background: page === n ? '#8B1A1A' : 'white',
                    color:      page === n ? 'white'   : '#374151',
                  }}>{n}</button>
                ))}
                {totalPages > 5 && <span style={{ fontSize: '12px', color: '#9CA3AF', padding: '0 4px' }}>...</span>}
              </div>
              <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
                عرض {visible.length} من أصل {filtered.length} خدام
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
