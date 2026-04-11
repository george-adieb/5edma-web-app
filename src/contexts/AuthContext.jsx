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
    console.log('[AuthContext] useEffect START');
    // Clean up any previous subscription from a Strict Mode first-mount
    if (subscriptionRef.current) {
      console.log('[AuthContext] unsubscribing previous onAuthStateChange');
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    // Reset resolution flag on each (re)mount
    resolvedRef.current = false;

    // Hard timeout safety net — if INITIAL_SESSION never fires (network issue,
    // Supabase outage, corrupt storage), we unblock the UI after AUTH_TIMEOUT_MS.
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

    console.log('[AuthContext] Setting up onAuthStateChange listener');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AuthContext] onAuthStateChange FIRED: event=${event}, hasSession=${!!session}`);
        const currentUser = session?.user ?? null;

        switch (event) {
          case 'INITIAL_SESSION': {
            // Guard: only handle the very first fire (Strict Mode can re-register
            // the listener which would fire INITIAL_SESSION twice)
            if (resolvedRef.current) {
              console.log('[AuthContext] INITIAL_SESSION ignored (already resolved)');
              break;
            }
            console.log('[AuthContext] INITIAL_SESSION handling');
            resolvedRef.current = true;

            setUser(currentUser);
            if (currentUser) {
              await fetchProfile(currentUser.id);
            }
            console.log('[AuthContext] INITIAL_SESSION resolving loading');
            resolveLoading();
            break;
          }

          case 'SIGNED_IN': {
            console.log('[AuthContext] SIGNED_IN handling');
            setUser(currentUser);
            if (currentUser) {
              await fetchProfile(currentUser.id);
            }
            // Also resolve loading in case INITIAL_SESSION was skipped
            if (!resolvedRef.current) {
              resolvedRef.current = true;
              console.log('[AuthContext] SIGNED_IN resolving loading');
              resolveLoading();
            }
            break;
          }

          case 'USER_UPDATED':
            console.log('[AuthContext] USER_UPDATED handling');
            setUser(currentUser);
            if (currentUser) {
              fetchProfile(currentUser.id); // fire-and-forget, non-blocking
            }
            break;

          case 'TOKEN_REFRESHED':
            console.log('[AuthContext] TOKEN_REFRESHED handling');
            // Silent background refresh — never touch loading state
            setUser(currentUser);
            break;

          case 'SIGNED_OUT':
            console.log('[AuthContext] SIGNED_OUT handling');
            setUser(null);
            setProfile(null);
            resolvedRef.current = true;
            resolveLoading();
            break;

          default:
            console.log(`[AuthContext] Unknown event: ${event}`);
            break;
        }
      }
    );

    subscriptionRef.current = subscription;

    console.log('[AuthContext] Calling getSession manually');
    supabase.auth.getSession().then(({ data, error }) => {
      console.log('[AuthContext] getSession returned manually:', { hasSession: !!data?.session, error });
    }).catch(err => {
      console.error('[AuthContext] getSession manual call thrown error:', err);
    });

    return () => {
      console.log('[AuthContext] useEffect cleanup');
      // On cleanup (true unmount OR Strict Mode first-mount teardown),
      // always unsubscribe so the next mount starts fresh.
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
