import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Share2, Edit3, Plus, Heart, Loader2, Star, Copy, CheckCheck, MessageCircle } from 'lucide-react';
import {
  fetchStudent,
  fetchStudentAttendance,
  fetchFollowUpLogs,
  fetchFollowUpByStudentId,
  saveFollowUpLog,
  updateFollowUpLog,
  fetchStudentPointsLogs,
  fetchStudentPointsSummary,
  updateStudentLocation,
  updateStudentAddress,
} from '../lib/database';
import AddPointsModal from '../components/AddPointsModal';
import LocationPickerModal from '../components/LocationPickerModal';

function normalizeEgyptianPhoneForWhatsApp(phone) {
  if (!phone) return null;
  let p = phone.replace(/[\s\-\(\)\+]/g, '');
  if (p.startsWith('01') && p.length === 11) return '2' + p;
  if (p.startsWith('20') && p.length === 12) return p;
  if (p.startsWith('0020')) return p.substring(2);
  return p;
}

function getWhatsAppUrl(phone) {
  const norm = normalizeEgyptianPhoneForWhatsApp(phone);
  if (!norm) return null;
  return `https://wa.me/${norm}`;
}

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

  // Points state
  const [totalPoints,      setTotalPoints]      = useState(0);
  const [pointsLogs,       setPointsLogs]       = useState([]);
  const [showAllPoints,    setShowAllPoints]    = useState(false);
  const [showAddPoints,    setShowAddPoints]    = useState(false);

  // Copy code state
  const [copySuccess,      setCopySuccess]      = useState(false);

  // Location state
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationSaving,     setLocationSaving]     = useState(false);
  const [locationSuccess,    setLocationSuccess]    = useState(false);

  // Note form state
  const [showNoteForm,   setShowNoteForm]   = useState(false);
  const [newNote,        setNewNote]        = useState('');
  const [newNoteType,    setNewNoteType]    = useState('مكالمة');
  const [isSavingNote,   setIsSavingNote]   = useState(false);

  // Edit note state
  const [editLogId,      setEditLogId]      = useState(null);
  const [editNote,       setEditNote]       = useState('');
  const [editNoteType,   setEditNoteType]   = useState('مكالمة');
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);

  // Edit address state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressDraft,     setAddressDraft]     = useState('');
  const [isSavingAddress,  setIsSavingAddress]  = useState(false);

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
        setError('تعذّر تحميل بيانات المخدوم');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Load points separately (non-blocking)
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchStudentPointsSummary(id),
      fetchStudentPointsLogs(id, 20),
    ]).then(([summary, logs]) => {
      setTotalPoints(summary[id] ?? 0);
      setPointsLogs(logs);
    }).catch(err => console.warn('[StudentProfile] points load error:', err));
  }, [id]);

  async function refreshPoints() {
    try {
      const [summary, logs] = await Promise.all([
        fetchStudentPointsSummary(id),
        fetchStudentPointsLogs(id, 20),
      ]);
      setTotalPoints(summary[id] ?? 0);
      setPointsLogs(logs);
    } catch (e) { console.warn('refresh points error', e); }
  }

  async function handleCopyCode() {
    const code = student?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px', gap: '10px' }}>
      <Loader2 size={26} style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} />
      <p style={{ fontSize: '14px', color: '#9CA3AF' }}>جارٍ تحميل ملف المخدوم...</p>
    </div>
  );

  // ── Error / Not found ────────────────────────────────────────────────────────
  if (error || !student) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <p style={{ fontSize: '36px', marginBottom: '12px' }}>{error ? '⚠️' : '😕'}</p>
      <p style={{ fontSize: '16px', fontWeight: 700, color: '#374151' }}>
        {error || 'المخدوم غير موجود'}
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
  
  // Natively calculate attendance rate derived from real history records
  const totalCycles = attendanceHistory.length;
  const presentCount = attendanceHistory.filter(r => r.status === 'حاضر').length;
  const attendanceRate = totalCycles > 0 ? Math.round((presentCount / totalCycles) * 100) : 0;
  const hasHistory = totalCycles > 0;
  
  // `attendanceHistory` is sorted newest->oldest by `fetchStudentAttendance`
  const mostRecentPresent = attendanceHistory.find(r => r.status === 'حاضر');
  const lastAttendedDate = mostRecentPresent ? mostRecentPresent.date : null;

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setIsSavingNote(true);
    try {
      await saveFollowUpLog({
        studentId: student.id,
        type: newNoteType,
        notes: newNote,
        contactStatus: 'تم التواصل', // Strict compliance with valid DB enum states
      });
      // Refresh logs inline
      const updatedLogs = await fetchFollowUpLogs(20, student.id);
      setFollowUpLogs(updatedLogs);
      setShowNoteForm(false);
      setNewNote('');
    } catch (err) {
      console.error('Failed to save note:', err);
      alert('تعذّر حفظ الملاحظة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleUpdateNote() {
    if (!editNote.trim() || !editLogId) return;
    setIsUpdatingNote(true);
    try {
      await updateFollowUpLog(editLogId, { type: editNoteType, notes: editNote });
      // Refresh logs inline
      const updatedLogs = await fetchFollowUpLogs(20, student.id);
      setFollowUpLogs(updatedLogs);
      setEditLogId(null);
      setEditNote('');
    } catch (err) {
      console.error('Failed to update note:', err);
      alert('تعذّر تحديث الملاحظة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsUpdatingNote(false);
    }
  }

  function startEdit(log) {
    setEditLogId(log.id);
    setEditNote(log.notes || '');
    setEditNoteType(log.type || 'مكالمة');
  }

  async function handleSaveLocation(lat, lng) {
    setLocationSaving(true);
    try {
      await updateStudentLocation(student.id, lat, lng);
      // Refresh student data to reflect new coords
      const updated = await fetchStudent(student.id);
      setStudent(updated);
      setLocationSuccess(true);
      setTimeout(() => setLocationSuccess(false), 3000);
    } finally {
      setLocationSaving(false);
    }
  }

  async function handleSaveAddress() {
    setIsSavingAddress(true);
    try {
      await updateStudentAddress(id, addressDraft);
      setStudent(s => ({ ...s, address: addressDraft }));
      setIsEditingAddress(false);
    } catch (err) {
      console.error('Failed to save address', err);
      alert('حدث خطأ أثناء حفظ العنوان');
    } finally {
      setIsSavingAddress(false);
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `ملف المخدوم ${student.name}`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Share failed', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('تم نسخ الرابط بنجاح');
    }
  }

  return (
    <>
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/students')}
          style={{ fontSize: '13px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}
        >
          المخدومين
        </button>
        <span style={{ color: '#D1D5DB', fontSize: '13px' }}>›</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#8B1A1A' }}>ملف المخدوم</span>
      </div>

      {/* Profile header card */}
      <div style={{
        background: 'white', borderRadius: '14px', padding: '24px',
        marginBottom: '16px', border: '1px solid #F3F4F6',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {/* Info (right) */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>
            {/* Avatar */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '14px', flexShrink: 0,
              background: avatarColor, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', fontWeight: 900,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>{student.avatar}</div>

            <div>
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: '6px',
                background: `${badge.color}15`, color: badge.color,
                fontSize: '12px', fontWeight: 800, marginBottom: '8px',
              }}>{student.status}</span>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#111827', marginBottom: '12px', lineHeight: 1.2 }}>
                {student.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <span style={{ fontSize: '16px' }}>🎓</span> {student.grade || student.grade_id || '—'}
                </span>
                {student.parent_phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <span style={{ fontSize: '16px' }}>📱</span> المخدوم: <span dir="ltr">{student.parent_phone}</span>
                    </span>
                    <a
                      href={`tel:${student.parent_phone}`}
                      style={{ color: '#16A34A', display: 'flex', alignItems: 'center', padding: '4px', background: '#DCFCE7', borderRadius: '6px', textDecoration: 'none' }}
                    >
                      <Phone size={14} />
                    </a>
                    {getWhatsAppUrl(student.parent_phone) && (
                      <a
                        href={getWhatsAppUrl(student.parent_phone)}
                        target="_blank" rel="noopener noreferrer"
                        aria-label="فتح واتساب للمخدوم"
                        style={{ color: '#25D366', display: 'flex', alignItems: 'center', padding: '4px', background: '#E8FDF0', borderRadius: '6px', textDecoration: 'none' }}
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}
                  </div>
                )}
                {student.parent_phone_2 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <span style={{ fontSize: '16px' }}>☎️</span> ولي الأمر: <span dir="ltr">{student.parent_phone_2}</span>
                    </span>
                    <a
                      href={`tel:${student.parent_phone_2}`}
                      style={{ color: '#1D4ED8', display: 'flex', alignItems: 'center', padding: '4px', background: '#DBEAFE', borderRadius: '6px', textDecoration: 'none' }}
                    >
                      <Phone size={14} />
                    </a>
                    {getWhatsAppUrl(student.parent_phone_2) && (
                      <a
                        href={getWhatsAppUrl(student.parent_phone_2)}
                        target="_blank" rel="noopener noreferrer"
                        aria-label="فتح واتساب لولي الأمر"
                        style={{ color: '#25D366', display: 'flex', alignItems: 'center', padding: '4px', background: '#E8FDF0', borderRadius: '6px', textDecoration: 'none' }}
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}
                  </div>
                )}
                {(!student.parent_phone && !student.parent_phone_2) && (
                  <span style={{ fontSize: '13px', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <span style={{ fontSize: '16px' }}>📞</span> لا يوجد رقم
                  </span>
                )}
                <span style={{ fontSize: '13px', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <span style={{ fontSize: '16px' }}>🎂</span> {student.birth_date || '—'}
                </span>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                  background: '#FEF2F2', color: '#8B1A1A', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <span style={{ fontSize: '14px' }}>🔰</span> قيد الخدمة
                </span>
              </div>
            </div>
          </div>
          
          {/* Actions (left) */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate(`/students/edit/${student.id}`)}
              title="تعديل بيانات المخدوم"
              style={{
                width: '40px', height: '40px', borderRadius: '10px',
                border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563',
            }}><Edit3 size={16} /></button>
            <button
              onClick={handleShare}
              title="مشاركة الملف"
              style={{
                width: '40px', height: '40px', borderRadius: '10px',
                border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563',
            }}><Share2 size={16} /></button>
          </div>
        </div>
      </div>

      {/* Main content: 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
        
        {/* RIGHT: stats + info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Attendance rate */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '18px 20px',
            border: '1.5px solid #FECACA', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
                background: 'linear-gradient(270deg, #8B1A1A, #C9A84C)',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
                {hasHistory
                  ? (lastAttendedDate ? `آخر حضور: ${lastAttendedDate}` : 'بانتظار الحضور')
                  : 'لم يحضر بعد'}
              </p>
              <span style={{
                fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                background: attendanceRate >= 80 ? '#DCFCE7' : attendanceRate >= 50 ? '#FEF9C3' : '#FEE2E2',
                color: attendanceRate >= 80 ? '#16A34A' : attendanceRate >= 50 ? '#D97706' : '#DC2626',
                fontWeight: 700,
              }}>
                {!hasHistory ? 'لا توجد بيانات' : attendanceRate >= 80 ? 'متفوق' : attendanceRate >= 50 ? 'مقبول' : 'يحتاج متابعة'}
              </span>
            </div>
          </div>

          {/* Medical info */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 18px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px' }}>🛡️</span>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>معلومات طبية</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>فصيلة الدم</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{student.blood_type || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>حساسية</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{student.medical_notes || 'لا يوجد'}</span>
              </div>
            </div>
          </div>

          {/* Hobbies */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 18px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px' }}>🌟</span>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>المواهب والاهتمامات</h3>
            </div>
            {student.hobbies && student.hobbies.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {student.hobbies.map((h, i) => (
                  <span key={i} style={{
                    padding: '5px 12px', borderRadius: '20px',
                    background: '#FEF2F2', color: '#8B1A1A',
                    fontSize: '12px', fontWeight: 600,
                  }}>{h}</span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#9CA3AF' }}>لا توجد اهتمامات مسجلة</p>
            )}
          </div>

          {/* Location section */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 18px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px' }}>📍</span>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>العنوان والموقع</h3>
              </div>
            </div>

            {/* Detailed Address */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', margin: 0 }}>العنوان التفصيلي</p>
                {!isEditingAddress && (
                  <button
                    onClick={() => {
                      setAddressDraft(student.address || '');
                      setIsEditingAddress(true);
                    }}
                    style={{
                      background: 'none', border: 'none', padding: '4px 8px',
                      color: '#1D4ED8', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    ✏️ تعديل العنوان
                  </button>
                )}
              </div>
              
              {isEditingAddress ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    value={addressDraft}
                    onChange={e => setAddressDraft(e.target.value)}
                    placeholder="اكتب العنوان بالتفصيل..."
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      border: '1.5px solid #8B1A1A', outline: 'none',
                      fontFamily: 'Cairo, sans-serif', fontSize: '13px', direction: 'rtl',
                      minHeight: '70px', resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setIsEditingAddress(false)}
                      disabled={isSavingAddress}
                      style={{
                        padding: '6px 12px', borderRadius: '6px', background: 'white',
                        border: '1px solid #D1D5DB', color: '#4B5563', fontSize: '11px',
                        fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo, sans-serif'
                      }}
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleSaveAddress}
                      disabled={isSavingAddress}
                      style={{
                        padding: '6px 14px', borderRadius: '6px', background: 'linear-gradient(135deg,#8B1A1A,#B52626)',
                        border: 'none', color: 'white', fontSize: '11px',
                        fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo, sans-serif'
                      }}
                    >
                      {isSavingAddress ? 'جاري الحفظ...' : 'حفظ العنوان'}
                    </button>
                  </div>
                </div>
              ) : student.address ? (
                <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.6, background: '#F9FAFB', padding: '10px 12px', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                  {student.address}
                </p>
              ) : (
                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0, background: '#F9FAFB', padding: '10px 12px', borderRadius: '8px', border: '1px dashed #E5E7EB' }}>لم يتم إدخال العنوان التفصيلي</p>
              )}
            </div>

            {/* Map Location */}
            <div>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', margin: '0 0 6px' }}>الموقع على الخريطة</p>
              {student.latitude && student.longitude ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{
                    padding: '10px 12px', background: '#F0FDF4',
                    borderRadius: '8px', border: '1px solid #BBF7D0',
                  }}>
                    <p style={{ fontSize: '11px', color: '#166534', fontWeight: 700, margin: '0 0 4px' }}>تم تحديد الموقع ✓</p>
                    <p style={{ fontSize: '11px', color: '#4B5563', margin: 0, direction: 'ltr', textAlign: 'right', fontWeight: 600 }}>
                    {parseFloat(student.latitude).toFixed(5)}, {parseFloat(student.longitude).toFixed(5)}
                  </p>
                  {student.location_updated_at && (
                    <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '3px 0 0' }}>
                      آخر تحديث: {new Date(student.location_updated_at).toLocaleDateString('ar-EG')}
                    </p>
                  )}
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${student.latitude},${student.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '9px 14px', borderRadius: '8px',
                    background: '#EFF6FF', color: '#1D4ED8', textDecoration: 'none',
                    fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: 700,
                    border: '1px solid #BFDBFE', transition: 'all 0.15s',
                  }}
                >
                  <span>🗺️</span> فتح على Google Maps
                </a>
                <button
                  onClick={() => setShowLocationPicker(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '9px 14px', borderRadius: '8px',
                    border: '1.5px solid #E5E7EB', background: 'white',
                    fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: 700,
                    color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s',
                    width: '100%',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#8B1A1A'; e.currentTarget.style.color = '#8B1A1A'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280'; }}
                >
                  📍 تعديل الموقع
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>
                  لم يتم تحديد موقع السكن بعد
                </p>
                <button
                  onClick={() => setShowLocationPicker(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px 14px', borderRadius: '9px',
                    background: 'linear-gradient(135deg,#8B1A1A,#B52626)',
                    color: 'white', border: 'none',
                    fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer', width: '100%',
                    boxShadow: '0 4px 12px rgba(139,26,26,0.25)',
                  }}
                >
                  📍 تحديد الموقع على الخريطة
                </button>
              </div>
            )}
            </div>

            {locationSuccess && (
              <div style={{
                marginTop: '8px', padding: '8px 12px', borderRadius: '8px',
                background: '#DCFCE7', color: '#166534',
                fontSize: '12px', fontWeight: 700, textAlign: 'center',
              }}>
                ✓ تم حفظ الموقع بنجاح
              </div>
            )}
          </div>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 18px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>إجراءات سريعة</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {student.parent_phone && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <a
                    href={`tel:${student.parent_phone}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '10px 14px', borderRadius: '9px',
                      background: '#F0FDF4', color: '#16A34A', textDecoration: 'none',
                      fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: 700,
                    }}
                  >
                    <Phone size={14} /> اتصال بالمخدوم
                  </a>
                  {getWhatsAppUrl(student.parent_phone) && (
                    <a
                      href={getWhatsAppUrl(student.parent_phone)}
                      target="_blank" rel="noopener noreferrer"
                      aria-label="فتح واتساب للمخدوم"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '10px 14px', borderRadius: '9px',
                        background: '#E8FDF0', color: '#25D366', textDecoration: 'none',
                        fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      <MessageCircle size={14} /> واتساب المخدوم
                    </a>
                  )}
                </div>
              )}
              {student.parent_phone_2 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <a
                    href={`tel:${student.parent_phone_2}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '10px 14px', borderRadius: '9px',
                      background: '#EFF6FF', color: '#1D4ED8', textDecoration: 'none',
                      fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: 700,
                    }}
                  >
                    <Phone size={14} /> اتصال ولي الأمر
                  </a>
                  {getWhatsAppUrl(student.parent_phone_2) && (
                    <a
                      href={getWhatsAppUrl(student.parent_phone_2)}
                      target="_blank" rel="noopener noreferrer"
                      aria-label="فتح واتساب لولي الأمر"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '10px 14px', borderRadius: '9px',
                        background: '#E8FDF0', color: '#25D366', textDecoration: 'none',
                        fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      <MessageCircle size={14} /> واتساب ولي الأمر
                    </a>
                  )}
                </div>
              )}
              <button
                onClick={() => navigate('/followup')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', borderRadius: '9px',
                  background: '#FEF2F2', color: '#8B1A1A',
                  fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700,
                  border: 'none', cursor: 'pointer', width: '100%',
                }}
              >
                <Heart size={15} /> تسجيل افتقاد
              </button>
            </div>
          </div>

          {/* ── Points card ── */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 18px',
            border: '1.5px solid #FDE68A', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px' }}>⭐</span>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>النقاط</h3>
              </div>
              <button
                onClick={() => setShowAddPoints(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 12px', borderRadius: '8px',
                  background: '#8B1A1A', color: 'white', border: 'none',
                  fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '11px', cursor: 'pointer',
                }}
              >
                <Plus size={12} /> إضافة نقاط
              </button>
            </div>

            {/* Total points display */}
            <div style={{
              background: 'linear-gradient(135deg, #FEF3C7, #FFFBEB)',
              borderRadius: '10px', padding: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '12px', border: '1px solid #FDE68A',
            }}>
              <div>
                <p style={{ fontSize: '11px', color: '#92400E', fontWeight: 600 }}>إجمالي النقاط</p>
                <p style={{ fontSize: '36px', fontWeight: 900, color: '#92400E', lineHeight: 1 }}>{totalPoints}</p>
              </div>
              <Star size={32} fill="#F59E0B" color="#F59E0B" style={{ opacity: 0.6 }} />
            </div>

            {/* Recent logs */}
            {pointsLogs.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>لا توجد نقاط مسجلة</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(showAllPoints ? pointsLogs : pointsLogs.slice(0, 4)).map(log => (
                  <div key={log.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: '8px', background: '#F9FAFB',
                    border: '1px solid #F3F4F6',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.reason}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#9CA3AF' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
                          background: log.points > 0 ? '#DCFCE7' : '#FEE2E2',
                          color: log.points > 0 ? '#16A34A' : '#DC2626'
                        }}>
                          {log.points > 0 ? 'إضافة' : 'خصم'}
                        </span>
                        <span>•</span>
                        <span>{log.created_by_name}</span>
                        <span>•</span>
                        <span>{log.time}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '14px', fontWeight: 900, flexShrink: 0, marginRight: '8px',
                      color: log.points > 0 ? '#16A34A' : '#DC2626',
                    }}>
                      {log.points > 0 ? '+' : ''}{log.points}
                    </span>
                  </div>
                ))}
                {pointsLogs.length > 4 && (
                  <button
                    onClick={() => setShowAllPoints(p => !p)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '11px', fontWeight: 700, color: '#8B1A1A',
                      fontFamily: 'Cairo, sans-serif', padding: '4px 0', textAlign: 'center',
                    }}
                  >
                    {showAllPoints ? 'عرض أقل' : `عرض الكل (${pointsLogs.length})`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Points Code card ── */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 18px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px' }}>🔑</span>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>كود النقاط</h3>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#F9FAFB', borderRadius: '10px', padding: '12px 14px',
              border: '1px solid #E5E7EB',
            }}>
              <code style={{
                flex: 1, fontSize: '16px', fontWeight: 900, color: '#8B1A1A',
                fontFamily: 'monospace', letterSpacing: '1px', direction: 'ltr',
                textAlign: 'left',
              }}>
                {student?.code || '—'}
              </code>
              {student?.code && (
                <button
                  id="copy-points-code-btn"
                  onClick={handleCopyCode}
                  title="نسخ كود النقاط"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '7px 12px', borderRadius: '8px', border: 'none',
                    background: copySuccess ? '#DCFCE7' : '#8B1A1A',
                    color: copySuccess ? '#16A34A' : 'white',
                    fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '11px',
                    cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0,
                  }}
                >
                  {copySuccess
                    ? <><CheckCheck size={13} /> تم النسخ</>
                    : <><Copy size={13} /> نسخ</>}
                </button>
              )}
            </div>
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '8px', lineHeight: 1.5 }}>
              يمكن للطالب استخدام هذا الكود على صفحة
              {' '}<a
                href="/my-points"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#8B1A1A', fontWeight: 700, textDecoration: 'none' }}
              >
                اعرف نقاطك
              </a>
            </p>
          </div>
        </div>

        {/* LEFT: attendance + notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Attendance history */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '18px 20px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>سجل الحضور الأخير</h3>
              <button onClick={() => navigate('/attendance')} style={{ fontSize: '12px', fontWeight: 700, color: '#8B1A1A', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                عرض السجل الكامل <span style={{ fontSize: '14px' }}>‹</span>
              </button>
            </div>
            {attendanceHistory.length > 0 ? (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {attendanceHistory.map((rec, i) => {
                  const s = ATT_STYLE[rec.status] || { bg: '#F3F4F6', color: '#6B7280', label: '?' };
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: s.bg, color: s.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '15px', fontWeight: 700,
                      }}>{s.label}</div>
                      <p style={{ fontSize: '11px', color: '#6B7280', textAlign: 'center', maxWidth: '42px', fontWeight: 600 }}>
                        {rec.date.split(' ').slice(0, 2).join(' ')}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#9CA3AF', padding: '12px 0' }}>لا يوجد سجل حضور</p>
            )}
          </div>

          {/* Follow-up / servant notes */}
          <div style={{
            background: 'white', borderRadius: '12px', padding: '18px 20px',
            border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showNoteForm ? '16px' : '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>ملاحظات الخادم</h3>
                <p style={{ fontSize: '11px', color: '#9CA3AF' }}>التاريخ الرعوي وتطور الحالة الروحية</p>
              </div>
              <button 
                onClick={() => setShowNoteForm(!showNoteForm)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '8px',
                  background: showNoteForm ? '#F3F4F6' : '#8B1A1A', 
                  color: showNoteForm ? '#374151' : 'white', border: 'none',
                  fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
              }}>
                <Plus size={14} style={{ transform: showNoteForm ? 'rotate(45deg)' : 'none', transition: '0.2s' }} />
                {showNoteForm ? 'إلغاء' : 'إضافة ملاحظة'}
              </button>
            </div>

            {showNoteForm && (
              <div style={{ background: '#F9FAFB', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '1px solid #E5E7EB', animation: 'fadeIn 0.2s ease' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {['مكالمة', 'زيارة', 'رسالة'].map(t => (
                    <button key={t} onClick={() => setNewNoteType(t)} style={{
                      padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      background: newNoteType === t ? '#8B1A1A' : 'white',
                      color: newNoteType === t ? 'white' : '#6B7280',
                      border: `1px solid ${newNoteType === t ? '#8B1A1A' : '#D1D5DB'}`, fontFamily: 'Cairo, sans-serif'
                    }}>{t}</button>
                  ))}
                </div>
                <textarea
                  value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="اكتب تفاصيل الملاحظة هنا..."
                  style={{ width: '100%', height: '70px', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontFamily: 'Cairo, sans-serif', fontSize: '13px', resize: 'none', marginBottom: '12px', direction: 'rtl', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                  onBlur={e => e.target.style.borderColor = '#D1D5DB'}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <button onClick={handleAddNote} disabled={isSavingNote || !newNote.trim()} style={{ 
                    padding: '8px 20px', borderRadius: '8px', background: '#8B1A1A', color: 'white', 
                    border: 'none', fontSize: '13px', fontWeight: 700, fontFamily: 'Cairo, sans-serif',
                    cursor: (isSavingNote || !newNote.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (isSavingNote || !newNote.trim()) ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    {isSavingNote ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> جاري الحفظ...</> : 'حفظ الملاحظة'}
                  </button>
                </div>
              </div>
            )}

            {!showNoteForm && followUpLogs.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#9CA3AF', padding: '16px 0' }}>لا توجد ملاحظات مسجلة</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                {followUpLogs.map((log, i) => {
                  if (editLogId === log.id) {
                    return (
                      <div key={log.id} style={{ background: '#F9FAFB', borderRadius: '10px', padding: '16px', border: '1px solid #E5E7EB', animation: 'fadeIn 0.2s ease' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                          {['مكالمة', 'زيارة', 'رسالة'].map(t => (
                            <button key={t} onClick={() => setEditNoteType(t)} style={{
                              padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                              background: editNoteType === t ? '#8B1A1A' : 'white',
                              color: editNoteType === t ? 'white' : '#6B7280',
                              border: `1px solid ${editNoteType === t ? '#8B1A1A' : '#D1D5DB'}`, fontFamily: 'Cairo, sans-serif'
                            }}>{t}</button>
                          ))}
                        </div>
                        <textarea
                          value={editNote} onChange={e => setEditNote(e.target.value)}
                          style={{ width: '100%', height: '70px', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontFamily: 'Cairo, sans-serif', fontSize: '13px', resize: 'none', marginBottom: '12px', direction: 'rtl', outline: 'none' }}
                          onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                          onBlur={e => e.target.style.borderColor = '#D1D5DB'}
                        />
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button onClick={handleUpdateNote} disabled={isUpdatingNote || !editNote.trim()} style={{ 
                            padding: '8px 20px', borderRadius: '8px', background: '#8B1A1A', color: 'white', 
                            border: 'none', fontSize: '13px', fontWeight: 700, fontFamily: 'Cairo, sans-serif',
                            cursor: (isUpdatingNote || !editNote.trim()) ? 'not-allowed' : 'pointer',
                            opacity: (isUpdatingNote || !editNote.trim()) ? 0.6 : 1,
                            display: 'flex', alignItems: 'center', gap: '6px'
                          }}>
                            {isUpdatingNote ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> جاري الحفظ...</> : 'حفظ التعديل'}
                          </button>
                          <button onClick={() => setEditLogId(null)} style={{ 
                            padding: '8px 20px', borderRadius: '8px', background: 'white', color: '#374151', 
                            border: '1px solid #D1D5DB', fontSize: '13px', fontWeight: 700, fontFamily: 'Cairo, sans-serif', cursor: 'pointer'
                          }}>إلغاء</button>
                        </div>
                      </div>
                    );
                  }

                  const t = FU_TYPE[log.type] || { bg: '#F3F4F6', color: '#6B7280', icon: '📝' };
                  return (
                    <div key={log.id || i} style={{
                      background: '#F9FAFB', borderRadius: '10px',
                      padding: '14px 16px', border: '1px solid #E5E7EB',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{
                          fontSize: '12px', padding: '4px 10px', borderRadius: '20px',
                          background: t.bg, color: t.color, fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: '6px'
                        }}><span style={{ fontSize: '15px' }}>{t.icon}</span> {log.type}</span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>{log.time}</span>
                          <button onClick={() => startEdit(log)} style={{
                            background: 'white', border: '1px solid #E5E7EB', color: '#6B7280', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }} title="تعديل الملاحظة"><Edit3 size={13} /></button>
                        </div>
                      </div>
                      <p style={{ fontSize: '14px', color: '#1F2937', lineHeight: 1.6, fontWeight: 500 }}>{log.notes}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>الخادم:</span>
                        <span style={{ fontSize: '12px', color: '#4B5563', fontWeight: 600 }}>{log.servant_name || log.recorded_by || '—'}</span>
                      </div>
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
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>حالة الافتقاد</h3>
                <span style={{
                  fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700,
                  background: followUp.urgency === 'urgent' ? '#DC2626' : '#D97706',
                  color: 'white',
                }}>
                  {followUp.urgency === 'urgent' ? '🔴 عاجل' : '🟡 عادي'}
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#374151', fontWeight: 600 }}>{followUp.absence_duration}</p>
              {followUp.last_contact && (
                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>
                  آخر تواصل: {followUp.last_contact}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Add Points Modal */}
    <AddPointsModal
      isOpen={showAddPoints}
      onClose={() => setShowAddPoints(false)}
      student={student}
      onSuccess={refreshPoints}
    />
    {/* Location Picker Modal */}
    <LocationPickerModal
      isOpen={showLocationPicker}
      onClose={() => setShowLocationPicker(false)}
      onSave={handleSaveLocation}
      initialLat={student?.latitude ? parseFloat(student.latitude) : null}
      initialLng={student?.longitude ? parseFloat(student.longitude) : null}
      studentName={student?.name || ''}
    />
    </>
  );
}
