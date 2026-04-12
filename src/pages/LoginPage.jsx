import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
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
            onError={(e) => {
              // Fallback to placeholder if image fails to load for any reason
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextSibling.style.display = 'flex';
            }}
          />
          {/* Fallback styling in case image doesn't exist yet */}
          <div style={{
            display: 'none', width: '64px', height: '64px', borderRadius: '14px',
            background: '#111827', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #D4AF37, #AA841A)', borderRadius: '50%' }} />
          </div>
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
          <button style={{
            background: 'none', border: 'none', color: '#6B7280', fontSize: '13px',
            fontFamily: 'Cairo, sans-serif', cursor: 'pointer', textDecoration: 'underline',
          }}>
            نسيت كلمة المرور؟
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '12px', color: '#9CA3AF', marginBottom: '16px' }}>
        <a href="#" style={{ color: '#9CA3AF', textDecoration: 'none' }}>سياسة الخصوصية</a>
        <a href="#" style={{ color: '#9CA3AF', textDecoration: 'none' }}>الدعم الفني</a>
        <a href="#" style={{ color: '#9CA3AF', textDecoration: 'none' }}>عن النظام</a>
      </div>
      <p style={{ fontSize: '11px', color: '#D1D5DB' }}>
        © 2024 سجل الخدمة - كنيستنا القبطية
      </p>
    </div>
  );
}
