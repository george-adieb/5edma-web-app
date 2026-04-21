import { useState, useEffect, useRef } from 'react';
import { Bell, LogOut, Menu, Search, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { performGlobalSearch } from '../../lib/database';

const PAGE_LABELS = {
  '/':              'نظرة عامة',
  '/attendance':    'الحضور',
  '/students':      'المخدومين',
  '/students/new':  'إضافة مخدوم جديد',
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

export default function TopBar({ onMenuClick, globalSearch, setGlobalSearch }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, profile, logout } = useAuth();
  
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching]     = useState(false);
  const [showDropdown, setShowDropdown]   = useState(false);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!globalSearch || globalSearch.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    
    let context = 'all';
    if (location.pathname.startsWith('/students')) context = 'students';
    else if (location.pathname.startsWith('/servants')) context = 'servants';

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await performGlobalSearch(globalSearch, context);
        setSearchResults(results);
        setShowDropdown(true);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearch, location.pathname]);

  const handleSelectResult = (item) => {
    setShowDropdown(false);
    setGlobalSearch(''); // Clear to close and clean context search string bounds natively 
    if (item.type === 'student') {
      navigate(`/students/${item.id}`);
    } else {
      // In the future this can jump to a servant profile page if built
      navigate('/servants'); 
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const pageLabel = PAGE_LABELS[location.pathname] ||
    (location.pathname.startsWith('/students/') ? 'ملف المخدوم' : 'الصفحة');

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
        {location.pathname !== '/' && (
          <>
            <span className="mob-hide" style={{ color: '#9CA3AF' }}>مارجرجس سيدي بشر</span>
            <span className="mob-hide" style={{ color: '#D1D5DB' }}>/</span>
          </>
        )}
        <span style={{ color: '#8B1A1A', fontWeight: 700 }}>{pageLabel}</span>
      </div>

      {/* ── Search (hidden on mobile, show as icon) ── */}
      <div ref={searchContainerRef} className="mob-hide" style={{ position: 'relative', width: '280px', marginInlineEnd: 'auto', marginInlineStart: '16px' }}>
        {isSearching ? (
          <Loader2 size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', animation: 'spin 1s linear infinite' }} />
        ) : (
          <Search size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
        )}
        <input
          type="text"
          placeholder={
            location.pathname.startsWith('/students') || location.pathname.startsWith('/attendance') || location.pathname.startsWith('/followup')
              ? "ابحث بالاسم أو الكود..."
              : location.pathname.startsWith('/servants')
                ? "ابحث باسم الخادم أو المرحلة..."
                : "ابحث عن اسم أو سجل..."
          }
          value={globalSearch || ''}
          onChange={e => setGlobalSearch(e.target.value)}
          style={{
            width: '100%', padding: '7px 36px 7px 12px',
            background: '#F9FAFB', border: '1.5px solid #F3F4F6',
            borderRadius: '8px', fontFamily: 'Cairo, sans-serif',
            fontSize: '13px', color: '#374151', outline: 'none',
            direction: 'rtl',
          }}
          onFocus={e  => { 
            e.target.style.borderColor = '#8B1A1A'; 
            e.target.style.background = 'white'; 
            if (globalSearch && globalSearch.length >= 2) setShowDropdown(true);
          }}
          onBlur={e   => { e.target.style.borderColor = '#F3F4F6'; e.target.style.background = '#F9FAFB'; }}
        />

        {/* ── Search Dropdown Overlay ── */}
        {showDropdown && globalSearch.length >= 2 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            marginTop: '8px', background: 'white', border: '1px solid #E5E7EB',
            borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxHeight: '300px', overflowY: 'auto', zIndex: 100, direction: 'rtl',
            animation: 'fadeIn 0.2s ease'
          }}>
            {searchResults.length === 0 && !isSearching ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#6B7280', fontSize: '12px' }}>لا توجد نتائج مطابقة</div>
            ) : (
              searchResults.map((item, idx) => {
                const nameStr = item.name || item.full_name || '';
                return (
                  <div key={item.id + idx} onClick={() => handleSelectResult(item)} style={{
                    padding: '10px 14px', borderBottom: idx === searchResults.length - 1 ? 'none' : '1px solid #F3F4F6',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', background: item.avatar_color || '#8B1A1A', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0
                    }}>{nameStr.charAt(0)}</div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>{nameStr}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, marginTop: '2px' }}>
                        {item.type === 'student' ? 'مخدوم' : 'خادم'} • {item.code || item.role || '—'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
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
