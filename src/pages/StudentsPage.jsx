import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Loader2 } from 'lucide-react';
import { fetchStudents } from '../lib/database';
import RowActionsMenu from '../components/RowActionsMenu';
import { GRADE_LABEL_MAP } from '../data/constants';
import StudentFilterBar, { useStudentFilters } from '../components/StudentFilterBar';
import { useIsMobile } from '../hooks/useWindowWidth';

const STATUS_BADGE = {
  منتظم:          { bg: '#DCFCE7', color: '#16A34A', dot: '#16A34A' },
  جديد:           { bg: '#DBEAFE', color: '#1D4ED8', dot: '#1D4ED8' },
  'يحتاج افتقاد': { bg: '#FEE2E2', color: '#DC2626', dot: '#DC2626' },
};

// Desktop: 6 columns
const COLS = '2.5fr 1fr 1.2fr 1fr 1.2fr 0.5fr';

export default function StudentsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [status,   setStatus]   = useState('all');
  const [page,     setPage]     = useState(1);
  const PER = 8;

  const { search, setSearch, stage, setStage, year, setYear, stageConfig, baseFiltered, clearFilters } = useStudentFilters(students);

  useEffect(() => {
    setLoading(true);
    fetchStudents()
      .then(data => setStudents(data))
      .catch(err  => { console.error(err); setError('تعذّر تحميل بيانات الطلاب'); })
      .finally(() => setLoading(false));
  }, []);

  const filtered   = baseFiltered.filter(s => status === 'all' || s.status === status);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const visible    = filtered.slice((page - 1) * PER, page * PER);

  const pillBtn = (active, onClick, label) => (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
      fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12.5px', border: 'none',
      background: active ? '#8B1A1A' : '#F3F4F6',
      color:      active ? 'white'   : '#6B7280',
      transition: 'all 0.15s', minHeight: '36px',
    }}>{label}</button>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', direction: 'rtl' }}>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '10px' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} />
          <p style={{ fontSize: '14px', color: '#9CA3AF' }}>جارٍ تحميل الطلاب...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</p>
          <p style={{ fontSize: '14px', color: '#DC2626', fontWeight: 700 }}>{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); fetchStudents().then(setStudents).catch(e => setError(e.message)).finally(() => setLoading(false)); }}
            style={{ marginTop: '12px', padding: '10px 20px', borderRadius: '8px', background: '#8B1A1A', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 700, minHeight: '44px' }}
          >إعادة المحاولة</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Page header */}
          <div style={{ textAlign: 'right', marginBottom: '18px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>قائمة المخدومين</h1>
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
              إدارة بيانات الطلاب، متابعة الحالات، وتحديث سجلات الحضور والافتقاد.
            </p>
          </div>

          {/* Filter bar */}
          <StudentFilterBar
            search={search} setSearch={setSearch}
            stage={stage}   setStage={setStage}
            year={year}     setYear={setYear}
            stageConfig={stageConfig}
            totalCount={students.length}
            filteredCount={filtered.length}
            onResetPage={() => setPage(1)}
            hasActiveFilters={stage !== 'all' || status !== 'all'}
            onClearFilters={() => { clearFilters(); setStatus('all'); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF' }}>الحالة</span>
              {pillBtn(status === 'all',           () => { setStatus('all');           setPage(1); }, 'الكل')}
              {pillBtn(status === 'منتظم',         () => { setStatus('منتظم');         setPage(1); }, 'منتظم')}
              {pillBtn(status === 'جديد',          () => { setStatus('جديد');          setPage(1); }, 'جديد')}
              {pillBtn(status === 'يحتاج افتقاد', () => { setStatus('يحتاج افتقاد'); setPage(1); }, 'افتقاد')}
            </div>
          </StudentFilterBar>

          {/* Table container */}
          <div style={{
            background: 'white', borderRadius: '12px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}>

            {/* ── Desktop table header ── */}
            {!isMobile && (
              <div style={{
                display: 'grid', gridTemplateColumns: COLS,
                padding: '10px 16px', background: '#FAFAFA',
                borderBottom: '1.5px solid #F3F4F6', direction: 'rtl',
              }}>
                {['الطالب', 'الكود', 'المرحلة', 'الحالة', 'آخر حضور', ''].map((h, i) => (
                  <p key={i} style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textAlign: i === 0 ? 'right' : 'center' }}>{h}</p>
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

            {/* ── Rows ── */}
            {visible.map(s => {
              const badge      = STATUS_BADGE[s.status] || { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' };
              const gradeLabel = s.grade || GRADE_LABEL_MAP[s.grade_id] || '—';

              // ── Mobile card ──
              if (isMobile) {
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/students/${s.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderBottom: '1px solid #F3F4F6',
                      cursor: 'pointer', direction: 'rtl',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                      background: s.avatar_color || s.avatarColor || '#8B1A1A', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700,
                    }}>{s.avatar}</div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{s.name}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{gradeLabel}</p>
                    </div>

                    {/* Status badge */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 8px', borderRadius: '20px', flexShrink: 0,
                      fontSize: '11px', fontWeight: 700,
                      background: badge.bg, color: badge.color,
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: badge.dot }} />
                      {s.status}
                    </span>

                    {/* Actions */}
                    <div onClick={e => e.stopPropagation()}>
                      <RowActionsMenu
                        onEdit={() => navigate(`/students/edit/${s.id}`)}
                        onDelete={() => console.log('Delete:', s.id)}
                      />
                    </div>
                  </div>
                );
              }

              // ── Desktop row ──
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'grid', gridTemplateColumns: COLS,
                    padding: '13px 16px', alignItems: 'center',
                    borderBottom: '1px solid #FAFAFA', cursor: 'pointer',
                    transition: 'background 0.1s', direction: 'rtl',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  onClick={() => navigate(`/students/${s.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      background: s.avatar_color || s.avatarColor || '#8B1A1A', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700,
                    }}>{s.avatar}</div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{s.name}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{s.code || '—'}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6B7280', textAlign: 'center', fontWeight: 600 }}>{s.code || '—'}</p>
                  <p style={{ fontSize: '12px', color: '#374151', textAlign: 'center' }}>{gradeLabel}</p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 10px', borderRadius: '20px',
                      fontSize: '12px', fontWeight: 700,
                      background: badge.bg, color: badge.color,
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: badge.dot, flexShrink: 0 }} />
                      {s.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>{s.last_attendance || s.lastAttendance || '—'}</p>
                  <div style={{ display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                    <RowActionsMenu
                      onEdit={() => navigate(`/students/edit/${s.id}`)}
                      onDelete={() => console.log('Delete:', s.id)}
                    />
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
                  <button key={n} onClick={() => setPage(n)} style={{
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
                عرض {visible.length} من أصل {filtered.length} طالب
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
