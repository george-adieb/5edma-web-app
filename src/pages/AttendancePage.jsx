import { useState, useEffect } from 'react';
import { Save, CheckCircle, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { fetchStudents, fetchAttendanceForDate, saveAttendance } from '../lib/database';
import {
  getActiveFriday,
  getPreviousFriday,
  getNextFriday,
  isCurrentCycle,
  formatFridayLabel,
} from '../lib/attendanceCycle';
import StudentFilterBar, { useStudentFilters } from '../components/StudentFilterBar';
import { useIsMobile } from '../hooks/useWindowWidth';

const STATUS = [
  { key: 'حاضر',  label: 'حاضر',  active: { background: '#16A34A', color: 'white', borderColor: '#16A34A' }, base: { background: 'transparent', color: '#16A34A', borderColor: '#16A34A' } },
  { key: 'غائب',  label: 'غائب',  active: { background: '#DC2626', color: 'white', borderColor: '#DC2626' }, base: { background: 'transparent', color: '#DC2626', borderColor: '#DC2626' } },
  { key: 'معتذر', label: 'معتذر', active: { background: '#D97706', color: 'white', borderColor: '#D97706' }, base: { background: 'transparent', color: '#D97706', borderColor: '#D97706' } },
];

const ROW_BG = { حاضر: '#F0FDF4', غائب: '#FFF1F2', معتذر: '#FFFBEB' };

export default function AttendancePage() {
  const isMobile  = useIsMobile();

  // ── Friday cycle state ─────────────────────────────────────
  // Initialise to the current active Friday (most-recent Friday ≤ today).
  const [selectedFriday, setSelectedFriday] = useState(() => getActiveFriday());
  const atCurrentCycle = isCurrentCycle(selectedFriday);

  // ── Data state ─────────────────────────────────────────────
  const [students,   setStudents]   = useState([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [attendance, setAttendance] = useState({});
  const [gender,     setGender]     = useState('all');
  const [saved,      setSaved]      = useState(false);
  const [page,       setPage]       = useState(1);
  const PER = 10;

  // ── Load students once ─────────────────────────────────────
  useEffect(() => {
    fetchStudents()
      .then(studs => { setStudents(studs); setStudentsLoaded(true); })
      .catch(err => console.error('Students load error:', err));
  }, []);

  // ── Load attendance whenever selected Friday changes ───────
  useEffect(() => {
    if (!studentsLoaded) return;
    setLoading(true);
    setSaved(false);
    fetchAttendanceForDate(selectedFriday)
      .then(records => setAttendance(records))
      .catch(err => console.error('Attendance load error:', err))
      .finally(() => setLoading(false));
  }, [selectedFriday, studentsLoaded]);

  // ── Navigation handlers ────────────────────────────────────
  function goToPreviousFriday() {
    setAttendance({});
    setPage(1);
    setSelectedFriday(prev => getPreviousFriday(prev));
  }

  function goToNextFriday() {
    if (atCurrentCycle) return; // guard: never allow future cycle
    setAttendance({});
    setPage(1);
    setSelectedFriday(prev => {
      const next = getNextFriday(prev);
      // Extra guard: clamp to active friday if somehow overshooting
      return next > getActiveFriday() ? getActiveFriday() : next;
    });
  }

  function jumpToCurrentFriday() {
    setAttendance({});
    setPage(1);
    setSelectedFriday(getActiveFriday());
  }

  // ── Filters & pagination ───────────────────────────────────
  const { search, setSearch, stage, setStage, year, setYear, stageConfig, baseFiltered, clearFilters } = useStudentFilters(students);

  const filtered   = baseFiltered.filter(s => gender === 'all' || s.gender === gender);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const visible    = filtered.slice((page - 1) * PER, page * PER);

  // ── Stats ──────────────────────────────────────────────────
  const present = Object.values(attendance).filter(v => v === 'حاضر').length;
  const absent  = Object.values(attendance).filter(v => v === 'غائب').length;
  const excused = Object.values(attendance).filter(v => v === 'معتذر').length;
  const rate    = students.length ? Math.round((present / students.length) * 100) : 0;
  const marked  = Object.values(attendance).filter(Boolean).length;

  // ── Attendance marking ─────────────────────────────────────
  function mark(id, status) {
    setAttendance(p => ({ ...p, [id]: p[id] === status ? null : status }));
    setSaved(false);
  }

  // ── Save ───────────────────────────────────────────────────
  async function save() {
    setSaving(true);
    try {
      await saveAttendance(attendance, selectedFriday);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
      alert('حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  }

  const pillBtn = (active, onClick, label) => (
    <button onClick={onClick} style={{
      padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
      fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', border: 'none',
      background: active ? '#8B1A1A' : '#F3F4F6',
      color:      active ? 'white'   : '#6B7280',
      transition: 'all 0.15s', minHeight: '36px',
    }}>{label}</button>
  );

  // ── Shared nav-button style ────────────────────────────────
  const navBtn = (disabled) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #E5E7EB',
    background: disabled ? '#F9FAFB' : 'white', cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? '#D1D5DB' : '#374151', transition: 'all 0.15s', flexShrink: 0,
  });

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', paddingBottom: '80px', direction: 'rtl' }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>تسجيل الحضور</h1>
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
            كل تسجيل مرتبط بجمعة خدمة محددة
          </p>
        </div>

        {/* Jump-to-current badge — only shown when viewing a past cycle */}
        {!atCurrentCycle && (
          <button onClick={jumpToCurrentFriday} style={{
            padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
            fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px',
            border: '1.5px solid #8B1A1A', color: '#8B1A1A', background: '#FEF2F2',
            transition: 'all 0.15s', whiteSpace: 'nowrap', minHeight: '36px',
          }}>
            العودة للجمعة الحالية
          </button>
        )}
      </div>

      {/* ── Friday Cycle Navigator ───────────────────────────── */}
      <div style={{
        background: 'white', borderRadius: '12px', padding: '12px 16px',
        marginBottom: '14px', border: '1px solid #F3F4F6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', direction: 'rtl',
      }}>
        {/* Prev button — always enabled (no limit on history) */}
        <button
          onClick={goToPreviousFriday}
          style={navBtn(false)}
          title="الجمعة السابقة"
        >
          <ChevronRight size={16} />
        </button>

        {/* Friday label */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 800, color: '#111827', margin: 0 }}>
            {formatFridayLabel(selectedFriday)}
          </p>
          {atCurrentCycle ? (
            <span style={{
              display: 'inline-block', marginTop: '3px',
              fontSize: '10px', fontWeight: 700,
              background: '#DCFCE7', color: '#16A34A',
              padding: '1px 8px', borderRadius: '20px',
            }}>
              دورة الخدمة الحالية
            </span>
          ) : (
            <span style={{
              display: 'inline-block', marginTop: '3px',
              fontSize: '10px', fontWeight: 700,
              background: '#FEF3C7', color: '#D97706',
              padding: '1px 8px', borderRadius: '20px',
            }}>
              تسجيل تاريخي
            </span>
          )}
        </div>

        {/* Next button — disabled when already at current cycle */}
        <button
          onClick={goToNextFriday}
          disabled={atCurrentCycle}
          style={navBtn(atCurrentCycle)}
          title={atCurrentCycle ? 'لا يمكن فتح جمعة مستقبلية' : 'الجمعة التالية'}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} />
          <p style={{ fontSize: '14px', color: '#9CA3AF' }}>جارٍ تحميل بيانات الحضور...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#9CA3AF' }}>إجمالي الطلاب</p>
                  <p style={{ fontSize: '30px', fontWeight: 900, color: '#111827', lineHeight: 1 }}>{students.length}</p>
                </div>
                <span style={{ fontSize: '24px' }}>🧑‍🎓</span>
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#9CA3AF' }}>نسبة الحضور</p>
                  <p style={{ fontSize: '30px', fontWeight: 900, color: '#8B1A1A', lineHeight: 1 }}>%{rate}</p>
                </div>
                <span style={{ fontSize: '24px' }}>👥</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <StudentFilterBar
            search={search} setSearch={setSearch}
            stage={stage}   setStage={setStage}
            year={year}     setYear={setYear}
            stageConfig={stageConfig}
            totalCount={students.length}
            filteredCount={filtered.length}
            onResetPage={() => setPage(1)}
            hasActiveFilters={stage !== 'all' || gender !== 'all'}
            onClearFilters={() => { clearFilters(); setGender('all'); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF' }}>النوع</span>
              {pillBtn(gender === 'all',  () => { setGender('all');  setPage(1); }, 'الكل')}
              {pillBtn(gender === 'ذكر',  () => { setGender('ذكر');  setPage(1); }, 'بنين')}
              {pillBtn(gender === 'أنثى', () => { setGender('أنثى'); setPage(1); }, 'بنات')}
            </div>
            <div style={{ width: '1px', height: '24px', background: '#E5E7EB', margin: '0 2px' }} />
            <button
              onClick={() => { const all = {}; filtered.forEach(s => { all[s.id] = 'حاضر'; }); setAttendance(p => ({ ...p, ...all })); }}
              style={{
                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px',
                border: '1.5px solid #8B1A1A', color: '#8B1A1A', background: 'transparent',
                minHeight: '36px', whiteSpace: 'nowrap',
              }}
            >تحديد الكل حاضر</button>
          </StudentFilterBar>

          {/* Student list */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>

            {/* Desktop-only table header */}
            {!isMobile && (
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 2.5fr',
                padding: '10px 16px', background: '#FAFAFA',
                borderBottom: '1.5px solid #F3F4F6',
              }}>
                {['اسم الطالب', 'آخر حضور', 'حالة الحضور'].map((h, i) => (
                  <p key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textAlign: i === 0 ? 'right' : 'center' }}>{h}</p>
                ))}
              </div>
            )}

            {visible.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</p>
                <p style={{ fontSize: '13px', color: '#6B7280' }}>لا توجد نتائج</p>
              </div>
            )}

            {visible.map(s => {
              const status = attendance[s.id];
              const borderAccent = status === 'حاضر' ? '#16A34A' : status === 'غائب' ? '#DC2626' : status === 'معتذر' ? '#D97706' : 'transparent';

              if (isMobile) {
                return (
                  <div key={s.id} style={{
                    padding: '12px 14px', borderBottom: '1px solid #F3F4F6',
                    background: status ? ROW_BG[status] : 'white',
                    borderRight: `3px solid ${borderAccent}`,
                    transition: 'background 0.15s',
                    direction: 'rtl',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                        background: s.avatar_color || s.avatarColor, color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700,
                      }}>{s.avatar}</div>
                      <div style={{ textAlign: 'right', flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{s.name}</p>
                        <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{s.grade}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {STATUS.map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => mark(s.id, opt.key)}
                          style={{
                            flex: 1, padding: '8px 4px', borderRadius: '8px', cursor: 'pointer',
                            fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px',
                            border: `1.5px solid ${opt.key === 'حاضر' ? '#16A34A' : opt.key === 'غائب' ? '#DC2626' : '#D97706'}`,
                            transition: 'all 0.1s', minHeight: '40px',
                            ...(status === opt.key ? opt.active : opt.base),
                          }}
                        >
                          {status === opt.key && (opt.key === 'حاضر' ? '✓ ' : opt.key === 'غائب' ? '✗ ' : '~ ')}{opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div key={s.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1.5fr 2.5fr',
                  padding: '12px 16px', alignItems: 'center',
                  borderBottom: '1px solid #FAFAFA',
                  background: status ? ROW_BG[status] : 'white',
                  transition: 'background 0.15s',
                  borderRight: `3px solid ${borderAccent}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-start' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                      background: s.avatar_color || s.avatarColor, color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700,
                    }}>{s.avatar}</div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{s.name}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{s.grade}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>{s.last_attendance || s.lastAttendance}</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {STATUS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => mark(s.id, opt.key)}
                        style={{
                          padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                          fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px',
                          border: `1.5px solid ${opt.key === 'حاضر' ? '#16A34A' : opt.key === 'غائب' ? '#DC2626' : '#D97706'}`,
                          transition: 'all 0.1s',
                          ...(status === opt.key ? opt.active : opt.base),
                        }}
                      >
                        {status === opt.key && (opt.key === 'حاضر' ? '✓ ' : opt.key === 'غائب' ? '✗ ' : '~ ')}{opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky bottom bar */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0,
            right: isMobile ? 0 : '240px',
            background: 'white', borderTop: '1px solid #F3F4F6',
            padding: '10px 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', zIndex: 30,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
            gap: '8px', flexWrap: 'wrap',
          }}>
            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', direction: 'rtl' }}>
              <button title="الصفحة السابقة" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #E5E7EB', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#D1D5DB' : '#6B7280', display: 'flex', alignItems: 'center', minHeight: '36px', transition: 'all 0.15s' }}>
                <ChevronRight size={16} />
              </button>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', minWidth: '50px', textAlign: 'center' }}>
                {page} من {totalPages}
              </span>
              <button title="الصفحة التالية" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #E5E7EB', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#D1D5DB' : '#6B7280', display: 'flex', alignItems: 'center', minHeight: '36px', transition: 'all 0.15s' }}>
                <ChevronLeft size={16} />
              </button>
            </div>

            <p className="mob-hide" style={{ fontSize: '12px', color: '#9CA3AF' }}>{filtered.length} طالب من أصل {students.length}</p>

            {/* Save button */}
            {saved ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', fontSize: '13px', fontWeight: 700 }}>
                <CheckCircle size={15} /> تم الحفظ!
              </div>
            ) : (
              <button onClick={save} disabled={!marked || saving} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '9px', minHeight: '40px',
                background: marked && !saving ? 'linear-gradient(135deg, #8B1A1A, #B52626)' : '#D1D5DB',
                color: 'white', fontFamily: 'Cairo, sans-serif', fontWeight: 700,
                fontSize: '13px', border: 'none', cursor: marked && !saving ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}>
                {saving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
                {saving ? 'جاري الحفظ...' : `حفظ (${marked}/${students.length})`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
