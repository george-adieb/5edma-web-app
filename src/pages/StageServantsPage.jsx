import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, UserPlus, Pencil, Trash2, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useWindowWidth';
import { listUsers, genderLabel, gradeText } from '../lib/userManagement';
import { AddUserModal, LeaderEditServantModal, DeactivateServantModal } from '../components/users/UserModals';

// Service Leader (SERVICE_HEAD) view: only servants inside the leader's grade + gender scope.
// The scope is enforced by the manage-users Edge Function; this page only displays what it returns.
const actBtn = (color) => ({ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #E5E7EB', background: 'white', color, fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px', cursor: 'pointer', minHeight: '34px' });

const disabledBtn = { opacity: 0.4, cursor: 'not-allowed' };

export default function StageServantsPage() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [servants, setServants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setServants((await listUsers()).users); }
    catch (e) { setError(e.message || 'تعذّر تحميل الخدام'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return servants.filter(u => !s || (u.full_name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s));
  }, [servants, q]);

  const myGrades = profile?.assigned_grades?.length ? profile.assigned_grades : (profile?.assigned_grade ? [profile.assigned_grade] : []);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0 }}>إدارة خدام المرحلة</h1>
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>الخدام في مراحلك ونوعك فقط</p>
        </div>
        <button onClick={() => setModal({ type: 'add' })} disabled={!myGrades.length} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: '#8B1A1A', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', minHeight: '44px', opacity: myGrades.length ? 1 : 0.5 }}>
          <UserPlus size={16} /> إضافة خادم
        </button>
      </div>

      <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Lock size={18} color="#92400E" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: '12.5px', color: '#78350F', margin: 0, lineHeight: 1.8 }}>
          نطاقك: <strong>{myGrades.join('، ') || '—'}</strong> — {profile?.assigned_gender ? genderLabel(profile.assigned_gender) : 'بنين وبنات'}. يمكنك إضافة خدام ضمن هذا النطاق فقط.
        </p>
      </div>

      <input placeholder="ابحث بالاسم أو البريد الإلكتروني..." value={q} onChange={e => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: '320px', padding: '8px 12px', border: '1.5px solid #F3F4F6', borderRadius: '8px', background: '#F9FAFB', fontFamily: 'Cairo, sans-serif', fontSize: '13px', direction: 'rtl', minHeight: '38px', marginBottom: '14px', boxSizing: 'border-box' }} />

      {loading && <div style={{ textAlign: 'center', padding: '60px' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} /></div>}
      {!loading && error && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#DC2626', fontWeight: 700, margin: '0 0 12px' }}>{error}</p>
          <button onClick={load} style={actBtn('#374151')}>إعادة المحاولة</button>
        </div>
      )}
      {!loading && !error && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #F3F4F6', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '640px' : 0 }}>
            <thead><tr style={{ background: '#FAFAFA' }}>
              {['اسم الخادم', 'البريد الإلكتروني', 'المرحلة الدراسية', 'النوع', 'الحالة', 'الإجراءات'].map(h => <th key={h} style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: '#9CA3AF', textAlign: 'right' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {shown.map(u => (
                <tr key={u.id} style={{ borderTop: '1px solid #F9FAFB' }}>
                  <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                    {u.full_name || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '12.5px', color: '#6B7280', direction: 'ltr', textAlign: 'right' }}>{u.email || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: '12.5px' }}>{gradeText(u)}</td>
                  <td style={{ padding: '10px 14px', fontSize: '12.5px' }}>{genderLabel(u.assigned_gender)}</td>
                  <td style={{ padding: '10px 14px', fontSize: '12.5px' }}>
                    <span style={{ background: '#DCFCE7', color: '#16A34A', fontWeight: 700, fontSize: '11.5px', padding: '3px 10px', borderRadius: 99 }}>نشط</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button disabled={!u.manageable} title={u.manageable ? '' : 'للخادم مراحل خارج نطاق إشرافك'} onClick={() => setModal({ type: 'edit', servant: u })} style={{ ...actBtn('#374151'), ...(u.manageable ? {} : disabledBtn) }}><Pencil size={13} /> تعديل</button>
                      <button disabled={!u.manageable} title={u.manageable ? '' : 'للخادم مراحل خارج نطاق إشرافك'} onClick={() => setModal({ type: 'delete', servant: u })} style={{ ...actBtn('#DC2626'), ...(u.manageable ? {} : disabledBtn) }}><Trash2 size={13} /> حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>لا يوجد خدام مسجلون في المراحل المحددة</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'add' && <AddUserModal mode="leader" leader={profile} onClose={() => setModal(null)} onCreated={load} />}
      {modal?.type === 'edit' && <LeaderEditServantModal servant={modal.servant} leader={profile} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === 'delete' && <DeactivateServantModal servant={modal.servant} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}
