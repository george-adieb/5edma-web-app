import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, UserPlus, Pencil, Eye, Users, Shield, UserCheck } from 'lucide-react';
import { GRADES } from '../data/constants';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useWindowWidth';
import {
  listUsers, fetchAuditLogs, isInactive, ROLE_LABELS, GENDER_OPTIONS, genderLabel, gradesOf, gradeText,
} from '../lib/userManagement';
import { AddUserModal, EditUserModal, UserDetailsModal, RoleBadge } from '../components/users/UserModals';

const ALL_GRADES = GRADES.filter(g => g.id).map(g => g.label);
const ACTION_LABELS = { create: 'إنشاء حساب', role_change: 'تغيير الدور', assignment_change: 'تغيير التعيين', profile_update: 'تعديل البيانات', password_reset: 'إعادة تعيين كلمة المرور', delete: 'حذف الحساب', deactivate: 'تعطيل الحساب', reactivate: 'إعادة تفعيل الحساب' };

const sel = { padding: '8px 12px', border: '1.5px solid #F3F4F6', borderRadius: '8px', background: '#F9FAFB', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#374151', direction: 'rtl', minHeight: '38px' };

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div style={{ flex: '1 1 150px', background: 'white', border: '1px solid #F3F4F6', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /></div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 700, margin: 0 }}>{label}</p>
        <p style={{ fontSize: '24px', fontWeight: 900, color: '#111827', margin: 0, lineHeight: 1.2 }}>{value}</p>
      </div>
    </div>
  );
}

const iconBtn = { display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #E5E7EB', background: 'white', color: '#374151', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '12px', cursor: 'pointer', minHeight: '34px' };

export default function UserManagementPage() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('all');
  const [gradeF, setGradeF] = useState('all');
  const [genderF, setGenderF] = useState('all');
  const [modal, setModal] = useState(null); // {type:'add'|'edit'|'view', user?}
  const [logs, setLogs] = useState(null);
  const [logsError, setLogsError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setUsers((await listUsers()).users); }
    catch (e) { setError(e.message || 'تعذّر تحميل المستخدمين'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'audit') return;
    setLogs(null); setLogsError('');
    fetchAuditLogs().then(setLogs).catch(e => setLogsError(e.message || 'تعذّر تحميل السجل'));
  }, [tab]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter(u => {
      if (s && !((u.full_name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s))) return false;
      if (roleF !== 'all' && u.role !== roleF) return false;
      if (gradeF !== 'all' && !gradesOf(u).includes(gradeF)) return false;
      if (genderF !== 'all' && u.assigned_gender !== genderF) return false;
      return true;
    });
  }, [users, q, roleF, gradeF, genderF]);

  const byId = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);
  const nameOf = (id, snap) => byId[id]?.full_name || snap?.full_name || (id ? id.slice(0, 8) : '—');
  const describe = (s) => s ? `${ROLE_LABELS[s.role] || s.role || '—'} • ${gradeText({ ...s, role: s.role })} • ${genderLabel(s.assigned_gender)}` : '—';

  const total = users.length;
  const leaders = users.filter(u => u.role === 'SERVICE_HEAD').length;
  const servants = users.filter(u => u.role === 'SERVANT').length;

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', background: tab === id ? '#8B1A1A' : '#F3F4F6', color: tab === id ? 'white' : '#6B7280' }}>{label}</button>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0 }}>إدارة المستخدمين</h1>
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>إنشاء الحسابات وتعديل الأدوار والمراحل</p>
        </div>
        <button onClick={() => setModal({ type: 'add' })} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: '#8B1A1A', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', minHeight: '44px', boxShadow: '0 4px 12px rgba(139,26,26,0.2)' }}>
          <UserPlus size={16} /> إضافة مستخدم
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <Stat icon={Users} label="إجمالي المستخدمين" value={total} color="#8B1A1A" />
        <Stat icon={Shield} label="أمناء الخدمة" value={leaders} color="#B45309" />
        <Stat icon={UserCheck} label="الخدام" value={servants} color="#4F46E5" />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {tabBtn('users', 'المستخدمون')}{tabBtn('audit', 'سجل التغييرات')}
      </div>

      {tab === 'users' && (
        <>
          <div style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', marginBottom: '14px', border: '1px solid #F3F4F6', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input placeholder="ابحث بالاسم أو البريد الإلكتروني..." value={q} onChange={e => setQ(e.target.value)} style={{ ...sel, flex: '1 1 220px' }} />
            <select value={roleF} onChange={e => setRoleF(e.target.value)} style={sel}>
              <option value="all">كل الأدوار</option>
              <option value="ADMIN">مدير النظام</option>
              <option value="SERVICE_HEAD">أمين خدمة</option>
              <option value="SERVANT">خادم</option>
            </select>
            <select value={gradeF} onChange={e => setGradeF(e.target.value)} style={sel}>
              <option value="all">كل المراحل</option>
              {ALL_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={genderF} onChange={e => setGenderF(e.target.value)} style={sel}>
              <option value="all">بنين وبنات</option>
              {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '60px' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} /></div>}
          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#DC2626', fontWeight: 700 }}>
              {error}<br /><button onClick={load} style={{ ...iconBtn, margin: '12px auto 0' }}>إعادة المحاولة</button>
            </div>
          )}
          {!loading && !error && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #F3F4F6', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '760px' : 0 }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {['اسم المستخدم', 'البريد الإلكتروني', 'الدور', 'المرحلة الدراسية', 'النوع', 'الإجراءات'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: '#9CA3AF', textAlign: 'right', borderBottom: '1.5px solid #F3F4F6' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                        {u.full_name || '—'}{isInactive(u) && <span style={{ marginInlineStart: 8, fontSize: 10.5, color: '#991B1B', background: '#FEE2E2', padding: '1px 7px', borderRadius: 99 }}>غير نشط</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12.5px', color: '#6B7280', direction: 'ltr', textAlign: 'right' }}>{u.email || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><RoleBadge role={u.role} /></td>
                      <td style={{ padding: '10px 14px', fontSize: '12.5px', color: '#374151' }}>{gradeText(u)}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12.5px', color: '#374151' }}>{genderLabel(u.assigned_gender)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button style={iconBtn} onClick={() => setModal({ type: 'edit', user: u })}><Pencil size={13} /> تعديل</button>
                          <button style={iconBtn} onClick={() => setModal({ type: 'view', user: u })}><Eye size={13} /> عرض التفاصيل</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>لا يوجد مستخدمون مطابقون</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'audit' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #F3F4F6', overflowX: 'auto' }}>
          {logsError && <p style={{ padding: '30px', textAlign: 'center', color: '#DC2626', fontWeight: 700 }}>{logsError}</p>}
          {!logsError && !logs && <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} /></div>}
          {logs && (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead><tr style={{ background: '#FAFAFA' }}>
                {['التاريخ', 'المنفّذ', 'المستخدم المستهدف', 'العملية', 'قبل', 'بعد'].map(h => <th key={h} style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: '#9CA3AF', textAlign: 'right' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={{ borderTop: '1px solid #F9FAFB', fontSize: '12.5px', color: '#374151' }}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('ar-EG')}</td>
                    <td style={{ padding: '10px 14px' }}>{nameOf(l.actor_id)}</td>
                    <td style={{ padding: '10px 14px' }}>{nameOf(l.target_id, l.new_state)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{ACTION_LABELS[l.action] || l.action}</td>
                    <td style={{ padding: '10px 14px' }}>{describe(l.previous_state)}</td>
                    <td style={{ padding: '10px 14px' }}>{describe(l.new_state)}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>لا توجد عمليات مسجلة بعد</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal?.type === 'add' && <AddUserModal mode="admin" onClose={() => setModal(null)} onCreated={load} />}
      {modal?.type === 'edit' && <EditUserModal user={modal.user} currentUserId={profile?.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === 'view' && <UserDetailsModal user={modal.user} onClose={() => setModal(null)} />}
    </div>
  );
}
