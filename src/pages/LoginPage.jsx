import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Loader2, X, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, logout } = useAuth();

  // Stop loading indicator if sign in completes
  useEffect(() => {
    if (user && !authLoading) {
      if (profile) {
        // Redirection based on role
        const role = profile.role;
        console.log('Redirecting based on role:', role);
        navigate('/', { replace: true });
      } else {
        // Edge case: User authenticated successfully, but no profile row exists in Supabase
        setErrorMsg('تم تسجيل الدخول لكن لا توجد صلاحيات / ملف شخصي. يرجى مراجعة المشرف.');
        setIsLoading(false);
        // We probably want to sign them out so they aren't stuck halfway
        logout();
      }
    }
  }, [user, profile, authLoading, navigate, logout]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    // Attempt Supabase login (Assuming email is used even if the label says "email or phone")
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);
      setErrorMsg('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      setIsLoading(false);
    } else {
      // If error is null, it means sign in was successful.
      // We rely on the useEffect above to catch the `user` and `profile` updates 
      // via AuthContext and redirect.
      // BUT as a safety net in case onAuthStateChange is acting up:
      setTimeout(() => {
        setIsLoading(false);
      }, 10000); // Stop spinning after 10s regardless.
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FAFAFA',
      backgroundImage: `radial-gradient(#F3F4F6 1px, transparent 1px)`,
      backgroundSize: '24px 24px',
      fontFamily: 'Cairo, sans-serif',
      direction: 'rtl',
      padding: '20px',
    }}>
      
      {/* ── Logo & Title ── */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          width: '120px', height: '120px', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img 
            src="/church-logo.png" 
            alt="شعار كنيسة مارجرجس سيدي بشر" 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#8B1A1A', lineHeight: 1.3 }}>
          كنيسة الشهيد العظيم <br/> مارجرجس سيدي بشر
        </h1>
        <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
          خدمة مدارس الأحد
        </p>
      </div>

      {/* ── Login Card ── */}
      <div style={{
        background: 'white',
        width: '100%',
        maxWidth: '400px',
        borderRadius: '20px',
        padding: '36px 32px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)',
        border: '1px solid #F9FAFB',
        marginBottom: '40px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>سجل الخدمة</h2>
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '6px' }}>يرجى تسجيل الدخول للمتابعة</p>
        </div>

        {errorMsg && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626',
            padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
            marginBottom: '20px', textAlign: 'center',
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Email/Phone Field */}
          <div>
            <label style={{ display: 'block', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
              البريد الإلكتروني أو رقم الهاتف
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                type="text"
                placeholder="example@church.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px 12px 40px',
                  background: '#F9FAFB', border: '1.5px solid #F3F4F6', borderRadius: '10px',
                  fontSize: '14px', outline: 'none', transition: 'all 0.2s',
                  textAlign: 'right', paddingRight: '40px', paddingLeft: '14px' // right side for icon
                }}
                onFocus={e => { e.target.style.borderColor = '#8B1A1A'; e.target.style.background = 'white'; }}
                onBlur={e => { e.target.style.borderColor = '#F3F4F6'; e.target.style.background = '#F9FAFB'; }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label style={{ display: 'block', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
              كلمة المرور
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '12px 40px 12px 40px',
                  background: '#F9FAFB', border: '1.5px solid #F3F4F6', borderRadius: '10px',
                  fontSize: '14px', outline: 'none', transition: 'all 0.2s',
                  textAlign: 'right', letterSpacing: password && !showPassword ? '2px' : 'normal',
                }}
                onFocus={e => { e.target.style.borderColor = '#8B1A1A'; e.target.style.background = 'white'; }}
                onBlur={e => { e.target.style.borderColor = '#F3F4F6'; e.target.style.background = '#F9FAFB'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%', padding: '14px', marginTop: '8px',
              background: isLoading ? '#9CA3AF' : '#8B1A1A', color: 'white',
              border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: 800, fontFamily: 'Cairo, sans-serif',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s', boxShadow: isLoading ? 'none' : '0 4px 12px rgba(139,26,26,0.25)',
            }}
          >
            {isLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'تسجيل الدخول'}
          </button>
        </form>

        {/* Forgot Password Link */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={() => setShowSupportModal(true)}
            style={{
              background: 'none', border: 'none', color: '#6B7280', fontSize: '13px',
              fontFamily: 'Cairo, sans-serif', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            نسيت كلمة المرور؟
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '12px', color: '#9CA3AF', marginBottom: '16px' }}>
        <button
          onClick={() => setShowSupportModal(true)}
          style={{
            background: 'none', border: 'none', color: '#9CA3AF', fontSize: '12px',
            fontFamily: 'Cairo, sans-serif', cursor: 'pointer', padding: 0,
          }}
        >
          تواصل مع الدعم الفني
        </button>
      </div>
      <p style={{ fontSize: '11px', color: '#D1D5DB' }}>
        © 2026 سجل خدمة مدارس الأحد - كنيسة الشهيد العظيم مارجرجس سيدي بشر
      </p>

      {/* ── Support Modal ── */}
      {showSupportModal && (
        <div
          onClick={() => setShowSupportModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.38)',
            backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '32px 28px 28px',
              width: '100%',
              maxWidth: '360px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
              border: '1px solid #F3F4F6',
              direction: 'rtl',
              fontFamily: 'Cairo, sans-serif',
              position: 'relative',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowSupportModal(false)}
              style={{
                position: 'absolute', top: '16px', left: '16px',
                background: '#F3F4F6', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#6B7280', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#E5E7EB'}
              onMouseLeave={e => e.currentTarget.style.background = '#F3F4F6'}
            >
              <X size={15} />
            </button>

            {/* Icon */}
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #8B1A1A 0%, #6B1414 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: '0 4px 12px rgba(139,26,26,0.3)',
            }}>
              <MessageCircle size={26} color="white" fill="white" />
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: '18px', fontWeight: 800, color: '#111827',
              marginBottom: '10px',
            }}>
              الدعم الفني
            </h3>

            {/* Message */}
            <p style={{
              fontSize: '13.5px', color: '#4B5563', lineHeight: 1.7,
              marginBottom: '8px',
            }}>
              للمساعدة أو الدعم الفني، برجاء التواصل عبر واتساب على الرقم التالي:
            </p>

            {/* Phone number */}
            <div style={{
              background: '#F5EAEA',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '24px',
              textAlign: 'center',
            }}>
              <span style={{
                fontSize: '16px', fontWeight: 800, color: '#8B1A1A',
                letterSpacing: '0.5px', direction: 'ltr', display: 'block',
              }}>
                +201004409418
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="https://wa.me/201004409418"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: 'linear-gradient(135deg, #8B1A1A 0%, #6B1414 100%)',
                  color: 'white', borderRadius: '10px',
                  padding: '13px 20px',
                  fontSize: '14px', fontWeight: 800, fontFamily: 'Cairo, sans-serif',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(139,26,26,0.25)',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <MessageCircle size={16} />
                فتح واتساب
              </a>
              <button
                onClick={() => setShowSupportModal(false)}
                style={{
                  background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '10px',
                  padding: '12px 20px',
                  fontSize: '14px', fontWeight: 700, fontFamily: 'Cairo, sans-serif',
                  color: '#6B7280', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
