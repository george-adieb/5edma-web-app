import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

// Maximum ms we'll wait for INITIAL_SESSION before giving up and setting
// loading=false. Prevents infinite loading when Supabase is slow/offline.
const AUTH_TIMEOUT_MS = 8000;

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Track whether the initial session event has already been handled.
  // This is the correct guard for Strict Mode — instead of blocking the
  // second registration (which leaves the app with zero listeners if cleanup
  // ran first), we allow re-registration but skip duplicate resolution.
  const resolvedRef   = useRef(false);
  const timeoutRef    = useRef(null);
  const subscriptionRef = useRef(null);

  // -------------------------------------------------------------------------
  // Safely resolve loading — called exactly once
  // -------------------------------------------------------------------------
  const resolveLoading = useCallback(() => {
    console.log('[AuthContext] resolveLoading called');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setLoading(false);
  }, []);

  // -------------------------------------------------------------------------
  // Profile fetch — never blocks auth resolution
  // -------------------------------------------------------------------------
  const fetchProfile = useCallback(async (userId) => {
    console.log('[AuthContext] fetchProfile START for userId:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.log('[AuthContext] fetchProfile ERROR returned by supabase:', error);
        throw error;
      }
      console.log('[AuthContext] fetchProfile END success');
      setProfile(data);
    } catch (err) {
      console.error('[AuthContext] fetchProfile error:', err.message);
      setProfile(null);
      // Profile failure is non-fatal — app still works with user from auth session
    }
  }, []);

  // -------------------------------------------------------------------------
  // Auth listener setup
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Clean up any previous subscription from a Strict Mode first-mount
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    // Reset resolution flag on each (re)mount
    resolvedRef.current = false;

    // Hard timeout safety net
    timeoutRef.current = setTimeout(() => {
      if (!resolvedRef.current) {
        console.warn('[AuthContext] Auth timeout — forcing loading=false after', AUTH_TIMEOUT_MS, 'ms');
        resolvedRef.current = true;
        setUser(null);
        setProfile(null);
        setAuthError('انتهت مهلة التحقق من الجلسة. يرجى تسجيل الدخول مجدداً.');
        setLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    // Actively get the session instead of just waiting for INITIAL_SESSION
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (!resolvedRef.current) {
          resolvedRef.current = true;
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          if (currentUser) {
            await fetchProfile(currentUser.id);
          }
          resolveLoading();
        }
      } catch (err) {
        console.error('[AuthContext] getSession error:', err.message);
        if (!resolvedRef.current) {
          resolvedRef.current = true;
          resolveLoading();
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;

        switch (event) {
          case 'INITIAL_SESSION': {
            if (!resolvedRef.current) {
              resolvedRef.current = true;
              setUser(currentUser);
              if (currentUser) {
                await fetchProfile(currentUser.id);
              }
              resolveLoading();
            }
            break;
          }
          case 'SIGNED_IN': {
            setUser(currentUser);
            if (currentUser) {
              await fetchProfile(currentUser.id);
            }
            if (!resolvedRef.current) {
              resolvedRef.current = true;
              resolveLoading();
            }
            break;
          }
          case 'USER_UPDATED':
            setUser(currentUser);
            if (currentUser) {
              fetchProfile(currentUser.id); // fire-and-forget, non-blocking
            }
            break;
          case 'TOKEN_REFRESHED':
            setUser(currentUser);
            break;
          case 'SIGNED_OUT':
            setUser(null);
            setProfile(null);
            resolvedRef.current = true;
            resolveLoading();
            break;
          default:
            break;
        }
      }
    );

    subscriptionRef.current = subscription;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      // Clear state immediately — don't wait for SIGNED_OUT event timing
      setUser(null);
      setProfile(null);
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AuthContext] logout error:', err.message);
      // State already cleared above — nothing more to do here
    }
  }, []);

  // -------------------------------------------------------------------------
  // Loading screen — appears briefly on startup, never stuck
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', direction: 'rtl',
        fontFamily: 'Cairo, sans-serif', background: '#F8F7F5', gap: '14px',
      }}>
        <svg
          style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }}
          width="28" height="28" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>جارٍ التحقق من الجلسة...</p>
      </div>
    );
  }

  // Auth timeout error — show recovery screen instead of blank page
  if (authError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', direction: 'rtl',
        fontFamily: 'Cairo, sans-serif', background: '#F8F7F5',
        gap: '12px', padding: '24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: '32px' }}>⚠️</p>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>تعذّر التحقق من الجلسة</p>
        <p style={{ fontSize: '13px', color: '#9CA3AF', maxWidth: '320px', lineHeight: 1.7 }}>{authError}</p>
        <button
          onClick={() => { setAuthError(null); window.location.reload(); }}
          style={{
            marginTop: '8px', padding: '10px 24px', borderRadius: '8px',
            background: '#8B1A1A', color: 'white', border: 'none',
            cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
            fontWeight: 700, fontSize: '13px',
          }}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
