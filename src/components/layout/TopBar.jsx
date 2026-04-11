import { useState } from 'react';
import { Search, Bell, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const PAGE_LABELS = {
  '/': 'نظرة عامة',
  '/attendance': 'الحضور',
  '/students': 'الطلاب',
  '/students/new': 'إضافة طالب جديد',
  '/servants': 'الخدام',
  '/followup': 'الافتقاد',
  '/settings': 'الإعدادات',
};

// Map database roles to friendly Arabic titles
const ROLE_LABELS = {
  ADMIN: 'مدير النظام',
  GENERAL_SECRETARIAT: 'أمانة عامة',
  SERVICE_HEAD: 'أمين خدمة',
  STAGE_SERVANT: 'خادم',
};

export default function TopBar({ onMenuClick }) {
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const pageLabel = PAGE_LABELS[location.pathname] ||
    (location.pathname.startsWith('/students/') ? 'ملف الطالب' : 'الصفحة');

  // Derive display values from Auth
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'المستخدم';
  const roleName = profile?.role ? ROLE_LABELS[profile.role] || profile.role : 'زائر';
  
  // Create an avatar based on name
  const getAvatarParts = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0].charAt(0)} ${parts[parts.length - 1].charAt(0)}`;
    return name.charAt(0);
  };
  const avatarText = getAvatarParts(displayName);
  const avatarColor = '#8B1A1A'; // Default Church Red

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'white', borderBottom: '1px solid #F3F4F6',
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      direction: 'rtl',
    }}>
      {/* RIGHT: breadcrumb + bell (first in RTL = right) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <span style={{ color: '#8B1A1A', fontWeight: 700 }}>{pageLabel}</span>
          {location.pathname !== '/' && (
            <>
              <span style={{ color: '#D1D5DB' }}>›</span>
              <span style={{ color: '#9CA3AF' }}>مارجرجس سيدي بشر</span>
            </>
          )}
        </div>
        <button style={{
          position: 'relative', padding: '7px', borderRadius: '8px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#6B7280', transition: 'background 0.15s',
        }}>
          <Bell size={18} />
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            width: '7px', height: '7px', borderRadius: '50%',
            background: '#8B1A1A', border: '1.5px solid white',
          }} />
        </button>
      </div>

      {/* CENTER: search */}
      <div style={{ flex: 1, maxWidth: '380px', position: 'relative', marginRight: '20px' }}>
        <Search size={15} style={{
          position: 'absolute', right: '12px', top: '50%',
          transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none',
        }} />
        <input
          type="text"
          placeholder="ابحث عن طالب أو سجل..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 38px 8px 14px',
            background: '#F9FAFB', border: '1.5px solid #F3F4F6',
            borderRadius: '8px', fontFamily: 'Cairo, sans-serif',
            fontSize: '13px', color: '#374151',
            outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = '#8B1A1A'; e.target.style.background = 'white'; }}
          onBlur={e => { e.target.style.borderColor = '#F3F4F6'; e.target.style.background = '#F9FAFB'; }}
        />
      </div>

      {/* LEFT: user info (last in RTL, margin-right: auto pushes it to the far left) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
          background: avatarColor, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700,
        }}>
          {avatarText}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
            {displayName}
          </p>
          <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{roleName}</p>
        </div>
        <button 
          onClick={handleLogout}
          title="تسجيل الخروج"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9CA3AF', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', padding: '6px', marginRight: '4px',
            borderRadius: '6px', transition: 'color 0.2s',
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
