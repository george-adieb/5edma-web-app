import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarCheck, Users, User, Heart, Settings, UserPlus, X,
} from 'lucide-react';

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'لوحة التحكم' },
  { to: '/attendance', icon: CalendarCheck,   label: 'الحضور'      },
  { to: '/students',  icon: Users,            label: 'الطلاب'      },
  { to: '/servants',  icon: User,             label: 'الخدام'      },
  { to: '/followup',  icon: Heart,            label: 'الافتقاد'    },
  { to: '/settings',  icon: Settings,         label: 'الإعدادات'   },
];

function AddStudentBtn({ onClose }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => { navigate('/students/new'); onClose?.(); }}
      style={{
        width: '100%', padding: '11px 16px', borderRadius: '10px',
        background: 'linear-gradient(135deg, #8B1A1A, #B52626)',
        color: 'white', fontFamily: 'Cairo, sans-serif', fontWeight: 700,
        fontSize: '13px', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        boxShadow: '0 4px 12px rgba(139,26,26,0.25)', transition: 'all 0.2s',
        minHeight: '44px',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <UserPlus size={15} />
      إضافة طالب جديد
    </button>
  );
}

export default function Sidebar({ onClose }) {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div style={{
        padding: '14px 14px 12px',
        borderBottom: '1px solid #F3F4F6',
        background: 'linear-gradient(180deg, #fdf7f7 0%, #fff 100%)',
        position: 'relative',
      }}>
        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="mob-show"
          style={{
            position: 'absolute', top: '10px', left: '10px',
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#F3F4F6', border: 'none', cursor: 'pointer',
            alignItems: 'center', justifyContent: 'center',
            color: '#6B7280',
          }}
          aria-label="إغلاق القائمة"
        >
          <X size={16} />
        </button>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
          <img
            src="/church-logo.png"
            alt="كنيسة الشهيد العظيم مارجرجس سيدي بشر"
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              objectFit: 'cover', border: '2px solid #C9A84C',
              boxShadow: '0 2px 10px rgba(139,26,26,0.15)',
            }}
          />
        </div>
        {/* Church name */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '12px', color: '#8B1A1A', lineHeight: 1.45, direction: 'rtl' }}>
            كنيسة الشهيد العظيم
          </p>
          <p style={{ fontWeight: 800, fontSize: '12px', color: '#8B1A1A', lineHeight: 1.45, direction: 'rtl' }}>
            مارجرجس سيدي بشر
          </p>
          <p style={{ fontSize: '10.5px', color: '#9CA3AF', marginTop: '3px', fontWeight: 600 }}>
            سجل مدارس الأحد
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '8px',
              justifyContent: 'flex-end', fontWeight: 600, fontSize: '13.5px',
              textDecoration: 'none', transition: 'all 0.15s ease',
              color: isActive ? '#8B1A1A' : '#6B7280',
              background: isActive ? 'rgba(139,26,26,0.07)' : 'transparent',
              borderRight: isActive ? '3px solid #8B1A1A' : '3px solid transparent',
              minHeight: '44px',
            })}
          >
            <span>{label}</span>
            <Icon size={17} />
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '12px 12px 20px' }}>
        <AddStudentBtn onClose={onClose} />
      </div>
    </aside>
  );
}
