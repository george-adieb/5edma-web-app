import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Loader2, UserPlus } from 'lucide-react';
import { servantRoles, servantStages, servants as mockServants } from '../data/mockData';
import { useIsMobile } from '../hooks/useWindowWidth';

const STATUS_BADGE = {
  'نشط':     { bg: '#DCFCE7', color: '#16A34A', dot: '#16A34A' },
  'غير نشط': { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' },
};

const COLS = '2.5fr 1.5fr 1.5fr 1fr 1fr';

export default function ServantsPage() {
  const navigate = useNavigate();
  const { globalSearch, setGlobalSearch } = useOutletContext() || { globalSearch: '', setGlobalSearch: () => {} };
  const isMobile = useIsMobile();
  const [servants, setServants] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [stage,    setStage]    = useState('all');
  const [role,     setRole]     = useState('all');
  const [page,     setPage]     = useState(1);
  const PER = 8;

  useEffect(() => {
    setLoading(true);
    setTimeout(() => { setServants(mockServants); setLoading(false); }, 600);
  }, []);

  const filtered = servants.filter(s => {
    let matchSearch = true;
    if (globalSearch) {
      const q = globalSearch.toLowerCase();
      const sName = (s.name || '').toLowerCase();
      const sEmail = (s.email || '').toLowerCase();
      const sRole = (s.role || '').toLowerCase();
      const sStage = (s.stage || s.stage_group || '').toLowerCase();
      matchSearch = sName.includes(q) || sEmail.includes(q) || sRole.includes(q) || sStage.includes(q);
    }
    const r  = role  === 'all' || s.role  === role;
    const st = stage === 'all' || s.stage === stage;
    return matchSearch && r && st;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const visible    = filtered.slice((page - 1) * PER, page * PER);

  const pillBtn = (active, onClick, label) => (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
      fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12.5px', border: 'none',
      background: active ? '#8B1A1A' : '#F3F4F6',
      color:      active ? 'white'   : '#6B7280',
      transition: 'all 0.15s', minHeight: '34px',
    }}>{label}</button>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', direction: 'rtl' }}>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '10px' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} />
          <p style={{ fontSize: '14px', color: '#9CA3AF' }}>جارٍ تحميل الخدام...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</p>
          <p style={{ fontSize: '14px', color: '#DC2626', fontWeight: 700 }}>{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); setTimeout(() => { setServants(mockServants); setLoading(false); }, 600); }}
            style={{ marginTop: '12px', padding: '10px 20px', borderRadius: '8px', background: '#8B1A1A', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 700, minHeight: '44px' }}
          >إعادة المحاولة</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Page header — responsive flex */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>قائمة الخدام</h1>
              <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
                إدارة وتفاصيل خدام الخدمة والاجتماعات
              </p>
            </div>
            <button onClick={() => navigate('/servants/new')} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '10px',
              background: '#8B1A1A', color: 'white',
              border: 'none', cursor: 'pointer',
              fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px',
              boxShadow: '0 4px 12px rgba(139,26,26,0.2)',
              transition: 'transform 0.15s', flexShrink: 0, minHeight: '44px',
            }}>
              <UserPlus size={16} />
              إضافة خادم
            </button>
          </div>

          {/* Filter bar */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '14px 16px',
            marginBottom: '14px', border: '1px solid #F3F4F6',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            {/* Count + Search */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, textAlign: 'right' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', lineHeight: 1.2 }}>إجمالي البحث</p>
                  <p style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: 1.2 }}>من {servants.length} إجمالي</p>
                </div>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#111827' }}>{filtered.length}</span>
              </div>
              <div style={{ position: 'relative', flex: 1, minWidth: '140px', maxWidth: '280px' }}>
                <svg style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }}
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  placeholder="ابحث بالاسم أو البريد..."
                  value={globalSearch}
                  onChange={e => { setGlobalSearch(e.target.value); setPage(1); }}
                  style={{
                    width: '100%', padding: '8px 34px 8px 12px',
                    background: '#F9FAFB', border: '1.5px solid #F3F4F6',
                    borderRadius: '8px', fontFamily: 'Cairo, sans-serif',
                    fontSize: '13px', color: '#374151', direction: 'rtl', outline: 'none',
                    minHeight: '38px',
                  }}
                />
              </div>
            </div>

            {/* Stage pills */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', whiteSpace: 'nowrap' }}>المرحلة</span>
              {servantStages.map(c => <span key={c.id}>{pillBtn(stage === c.id, () => { setStage(c.id); setPage(1); }, c.label)}</span>)}
            </div>

            {/* Role pills */}
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', whiteSpace: 'nowrap' }}>الدور</span>
              {servantRoles.map(r => <span key={r.id}>{pillBtn(role === r.id, () => { setRole(r.id); setPage(1); }, r.label)}</span>)}
            </div>
          </div>

          {/* Table */}
          <div style={{
            background: 'white', borderRadius: '12px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}>
            {/* Desktop table header */}
            {!isMobile && (
              <div style={{
                display: 'grid', gridTemplateColumns: COLS,
                padding: '10px 16px', background: '#FAFAFA',
                borderBottom: '1.5px solid #F3F4F6', direction: 'rtl',
              }}>
                {['الاسم', 'الدور', 'المرحلة', 'الحالة', 'الإجراءات'].map((h, i) => (
                  <p key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textAlign: i === 0 ? 'right' : 'center' }}>{h}</p>
                ))}
              </div>
            )}

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

              // Mobile card
              if (isMobile) {
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', borderBottom: '1px solid #F3F4F6',
                    direction: 'rtl',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
                      background: s.avatarColor || '#8B1A1A', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700,
                    }}>{s.avatar}</div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{s.name}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{s.role} · {s.stage || '—'}</p>
                    </div>

                    {/* Status */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 8px', borderRadius: '20px', flexShrink: 0,
                      fontSize: '11px', fontWeight: 700,
                      background: badge.bg, color: badge.color,
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: badge.dot }} />
                      {s.status}
                    </span>
                  </div>
                );
              }

              // Desktop row
              return (
                <div key={s.id} style={{
                  display: 'grid', gridTemplateColumns: COLS,
                  padding: '13px 16px', alignItems: 'center',
                  borderBottom: '1px solid #FAFAFA',
                  transition: 'background 0.1s', direction: 'rtl',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                      background: s.avatarColor || '#8B1A1A', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700,
                    }}>{s.avatar}</div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{s.name}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{s.email || s.phone || '—'}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#8B1A1A', background: '#FEF2F2', padding: '4px 10px', borderRadius: '14px' }}>
                      {s.role}
                    </span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: '#374151', textAlign: 'center', fontWeight: 600 }}>{s.stage || '—'}</p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: badge.dot, flexShrink: 0 }} />
                      {s.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button style={{
                      padding: '6px 12px', borderRadius: '6px', background: 'white',
                      border: '1px solid #E5E7EB', cursor: 'pointer', color: '#374151',
                      fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: 700,
                      transition: 'all 0.15s', minHeight: '34px',
                    }}>عرض التفاصيل</button>
                  </div>
                </div>
              );
            })}

            {/* Pagination footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA',
              direction: 'rtl', flexWrap: 'wrap', gap: '8px',
            }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(n => (
                  <button key={`page-${n}`} onClick={() => setPage(n)} style={{
                    width: '34px', height: '34px', borderRadius: '6px', cursor: 'pointer',
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
