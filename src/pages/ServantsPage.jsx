import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Loader2, UserPlus } from 'lucide-react';
import { fetchServants } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useWindowWidth';

// ── Role filter options (maps to profiles.role) ───────────────
const ROLE_FILTER_OPTIONS = [
  { id: 'all', label: 'الكل' },
  { id: 'ADMIN', label: 'الأمانة العامة' },
  { id: 'GENERAL_SECRETARIAT', label: 'الأمانة العامة' },
  { id: 'SERVICE_HEAD', label: 'أمين خدمة' },
  { id: 'SERVANT', label: 'خادم مرحلة' },
];

// Deduplicated for display (ADMIN and GENERAL_SECRETARIAT share a label)
const ROLE_PILLS = [
  { id: 'all', label: 'الكل' },
  { id: 'ADMIN', label: 'الأمانة العامة' },
  { id: 'SERVICE_HEAD', label: 'أمين خدمة' },
  { id: 'SERVANT', label: 'خادم مرحلة' },
];

// Stage keyword pills — matched against stageDisplay text
const STAGE_PILLS = [
  { id: 'all', label: 'الكل' },
  { id: 'حضانة', label: 'حضانة' },
  { id: 'ابتدائي', label: 'ابتدائي' },
  { id: 'إعدادي', label: 'إعدادي' },
  { id: 'ثانوي', label: 'ثانوي' },
  { id: 'جامعة', label: 'جامعة' },
  { id: 'خريجين', label: 'خريجين' },
];

// Role badge style
const ROLE_BADGE_STYLE = {
  SERVANT: { bg: '#EEF2FF', color: '#4F46E5' },
  SERVICE_HEAD: { bg: '#FEF3C7', color: '#D97706' },
  ADMIN: { bg: '#FEE2E2', color: '#8B1A1A' },
  GENERAL_SECRETARIAT: { bg: '#FEE2E2', color: '#8B1A1A' },
};

const COLS = '2.5fr 1.5fr 2fr 1fr';

export default function ServantsPage() {
  const navigate = useNavigate();
  const { globalSearch, setGlobalSearch } = useOutletContext() || { globalSearch: '', setGlobalSearch: () => { } };
  const { profile: currentProfile } = useAuth();
  const isMobile = useIsMobile();

  const [servants, setServants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stageFilter, setStageFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const PER = 10;

  async function load() {
    if (!currentProfile) return; // wait for auth to resolve
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServants(currentProfile);
      console.log('[ServantsPage] scoped servants list:', data.map(s => ({ name: s.full_name, role: s.role, grade: s.assigned_grade || s.assigned_grades })));
      setServants(data);
    } catch (err) {
      console.error('[ServantsPage] load error:', err);
      setError('تعذّر تحميل قائمة الخدام. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentProfile]);

  // ── Filtering ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    return servants.filter(s => {
      // Global search: name, roleLabel, stageDisplay
      if (globalSearch) {
        const q = globalSearch.toLowerCase();
        const matchName = (s.full_name || '').toLowerCase().includes(q);
        const matchRole = (s.roleLabel || '').toLowerCase().includes(q);
        const matchStage = (s.stageDisplay || '').toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchStage) return false;
      }

      // Role filter — ADMIN and GENERAL_SECRETARIAT treated as the same pill
      if (roleFilter !== 'all') {
        const isAdminPill = roleFilter === 'ADMIN';
        if (isAdminPill) {
          if (s.role !== 'ADMIN' && s.role !== 'GENERAL_SECRETARIAT') return false;
        } else {
          if (s.role !== roleFilter) return false;
        }
      }

      // Stage keyword filter
      if (stageFilter !== 'all') {
        const stage = (s.stageDisplay || '').toLowerCase();
        if (!stage.includes(stageFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [servants, globalSearch, roleFilter, stageFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const visible = filtered.slice((page - 1) * PER, page * PER);

  // Reset to page 1 when filters change
  useEffect(() => setPage(1), [globalSearch, roleFilter, stageFilter]);

  // ── Pill button helper ─────────────────────────────────────
  const pillBtn = (active, onClick, label) => (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
      fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12.5px', border: 'none',
      background: active ? '#8B1A1A' : '#F3F4F6',
      color: active ? 'white' : '#6B7280',
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
            onClick={load}
            style={{ marginTop: '12px', padding: '10px 20px', borderRadius: '8px', background: '#8B1A1A', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 700, minHeight: '44px' }}
          >إعادة المحاولة</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Page header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>قائمة الخدام</h1>
              <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
                إدارة وتفاصيل خدام الخدمة — البيانات من نظام الحسابات مباشرةً
              </p>
            </div>
            {(currentProfile?.role === 'ADMIN' || currentProfile?.role === 'GENERAL_SECRETARIAT') && (
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
            )}
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
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  placeholder="ابحث بالاسم أو الدور أو المرحلة..."
                  value={globalSearch}
                  onChange={e => { setGlobalSearch(e.target.value); setPage(1); }}
                  style={{
                    width: '100%', padding: '8px 34px 8px 12px',
                    background: '#F9FAFB', border: '1.5px solid #F3F4F6',
                    borderRadius: '8px', fontFamily: 'Cairo, sans-serif',
                    fontSize: '13px', color: '#374151', direction: 'rtl', outline: 'none',
                    minHeight: '38px', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Stage pills */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', whiteSpace: 'nowrap' }}>المرحلة</span>
              {STAGE_PILLS.map(c => (
                <span key={c.id}>{pillBtn(stageFilter === c.id, () => { setStageFilter(c.id); setPage(1); }, c.label)}</span>
              ))}
            </div>

            {/* Role pills */}
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', whiteSpace: 'nowrap' }}>الدور</span>
              {ROLE_PILLS.map(r => (
                <span key={r.id}>{pillBtn(roleFilter === r.id, () => { setRoleFilter(r.id); setPage(1); }, r.label)}</span>
              ))}
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
                {['الاسم', 'الدور', 'المرحلة المسؤولة', 'تاريخ الإضافة'].map((h, i) => (
                  <p key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textAlign: i === 0 ? 'right' : 'center' }}>{h}</p>
                ))}
              </div>
            )}

            {/* Empty state */}
            {visible.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <p style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</p>
                <p style={{ fontSize: '13px', color: '#6B7280', fontWeight: 700 }}>لا توجد نتائج مطابقة</p>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>جرّب تعديل البحث أو الفلتر</p>
              </div>
            )}

            {/* Rows */}
            {visible.map(s => {
              const badgeStyle = ROLE_BADGE_STYLE[s.role] || { bg: '#F3F4F6', color: '#6B7280' };
              const joinedDate = s.created_at
                ? new Date(s.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';

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
                      background: s.avatarColor, color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700,
                    }}>{s.avatar}</div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{s.full_name || '—'}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{s.roleLabel} · {s.stageDisplay}</p>
                    </div>

                    {/* Role badge */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '4px 8px', borderRadius: '20px', flexShrink: 0,
                      fontSize: '11px', fontWeight: 700,
                      background: badgeStyle.bg, color: badgeStyle.color,
                    }}>
                      {s.roleLabel}
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
                  {/* Name + avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                      background: s.avatarColor, color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700,
                    }}>{s.avatar}</div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{s.full_name || '—'}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>
                        {s.assigned_gender ? s.assigned_gender : 'لا يوجد جنس محدد'}
                      </p>
                    </div>
                  </div>

                  {/* Role badge */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{
                      fontSize: '11.5px', fontWeight: 700,
                      background: badgeStyle.bg, color: badgeStyle.color,
                      padding: '4px 10px', borderRadius: '14px',
                    }}>
                      {s.roleLabel}
                    </span>
                  </div>

                  {/* Stage display */}
                  <p style={{
                    fontSize: '12.5px', color: '#374151',
                    textAlign: 'center', fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{s.stageDisplay}</p>

                  {/* Joined date */}
                  <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>{joinedDate}</p>
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map(n => (
                  <button key={`page-${n}`} onClick={() => setPage(n)} style={{
                    width: '34px', height: '34px', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px',
                    border: '1px solid #E5E7EB',
                    background: page === n ? '#8B1A1A' : 'white',
                    color: page === n ? 'white' : '#374151',
                  }}>{n}</button>
                ))}
                {totalPages > 7 && <span style={{ fontSize: '12px', color: '#9CA3AF', padding: '0 4px' }}>...</span>}
              </div>
              <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
                عرض {visible.length} من أصل {filtered.length} خادم
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
