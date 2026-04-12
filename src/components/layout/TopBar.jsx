import { useState } from 'react';
import { Bell, LogOut, Menu, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const PAGE_LABELS = {
  '/':              'نظرة عامة',
  '/attendance':    'الحضور',
  '/students':      'الطلاب',
  '/students/new':  'إضافة طالب جديد',
  '/servants':      'الخدام',
  '/followup':      'الافتقاد',
  '/settings':      'الإعدادات',
};

const ROLE_LABELS = {
  ADMIN:                'مدير النظام',
  GENERAL_SECRETARIAT:  'أمانة عامة',
  SERVICE_HEAD:         'أمين خدمة',
  STAGE_SERVANT:        'خادم',
};

export default function TopBar({ onMenuClick }) {
  const [search, setSearch]     = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, profile, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const pageLabel = PAGE_LABELS[location.pathname] ||
    (location.pathname.startsWith('/students/') ? 'ملف الطالب' : 'الصفحة');

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'المستخدم';
  const roleName    = profile?.role ? ROLE_LABELS[profile.role] || profile.role : 'زائر';

  const getAvatarParts = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`;
    return name.charAt(0);
  };
  const avatarText = getAvatarParts(displayName);

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'white', borderBottom: '1px solid #F3F4F6',
      padding: '0 16px',
      display: 'flex', alignItems: 'center', gap: '10px',
      height: '56px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      direction: 'rtl',
    }}>

      {/* ── Hamburger (mobile only) ── */}
      <button
        onClick={onMenuClick}
        className="mob-show"
        aria-label="القائمة"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#374151', padding: '6px',
          borderRadius: '8px', alignItems: 'center', justifyContent: 'center',
          minWidth: '40px', minHeight: '40px',
        }}
      >
        <Menu size={22} />
      </button>

      {/* ── Page title / breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', flex: 1 }}>
        <span style={{ color: '#8B1A1A', fontWeight: 700 }}>{pageLabel}</span>
        {location.pathname !== '/' && (
          <>
            <span className="mob-hide" style={{ color: '#D1D5DB' }}>›</span>
            <span className="mob-hide" style={{ color: '#9CA3AF' }}>مارجرجس سيدي بشر</span>
          </>
        )}
      </div>

      {/* ── Search (hidden on mobile, show as icon) ── */}
      <div className="mob-hide" style={{ position: 'relative', width: '280px' }}>
        <Search size={14} style={{
          position: 'absolute', right: '12px', top: '50%',
          transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none',
        }} />
        <input
          type="text"
          placeholder="ابحث عن طالب أو سجل..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '7px 36px 7px 12px',
            background: '#F9FAFB', border: '1.5px solid #F3F4F6',
            borderRadius: '8px', fontFamily: 'Cairo, sans-serif',
            fontSize: '13px', color: '#374151', outline: 'none',
          }}
          onFocus={e  => { e.target.style.borderColor = '#8B1A1A'; e.target.style.background = 'white'; }}
          onBlur={e   => { e.target.style.borderColor = '#F3F4F6'; e.target.style.background = '#F9FAFB'; }}
        />
      </div>

      {/* ── Bell ── */}
      <button style={{
        position: 'relative', padding: '7px', borderRadius: '8px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: '#6B7280',
      }}>
        <Bell size={18} />
        <span style={{
          position: 'absolute', top: '6px', right: '6px',
          width: '7px', height: '7px', borderRadius: '50%',
          background: '#8B1A1A', border: '1.5px solid white',
        }} />
      </button>

      {/* ── User info ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
          background: '#8B1A1A', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700,
        }}>
          {avatarText}
        </div>
        {/* Name + role — hidden on small screens */}
        <div className="mob-hide" style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{displayName}</p>
          <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{roleName}</p>
        </div>
        <button
          onClick={handleLogout}
          title="تسجيل الخروج"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9CA3AF', display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '6px',
            borderRadius: '6px', transition: 'color 0.2s',
            minWidth: '36px', minHeight: '36px',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
          onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
