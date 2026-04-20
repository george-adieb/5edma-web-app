import {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from 'react';
import { supabase } from '../lib/supabase';
import { authService } from '../services/authService';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentUserRef = useRef(null);
  const currentProfileRef = useRef(null);

  useEffect(() => { currentUserRef.current = user; }, [user]);
  useEffect(() => { currentProfileRef.current = profile; }, [profile]);

  // We use this ref to track if we're currently initializing the session
  // to avoid race conditions with the onAuthStateChange events firing simultaneously on mount.
  const isInitializingState = useRef(true);

  const resolveSession = useCallback(async (session, source) => {
    try {
      const u = session?.user ?? null;
      console.log(`[AuthContext] resolving session (${source}):`, u?.email ?? 'none');
      
      setUser(u);
      
      if (u) {
        const fetchProfilePromise = authService.fetchUserProfile(u.id, source);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth profile fetch timeout limit reached')), 8000)
        );
        
        const uProfile = await Promise.race([fetchProfilePromise, timeoutPromise]);
        
        setProfile(prevProfile => {
          if (uProfile?.isFallback && prevProfile && !prevProfile.isFallback) {
            console.log('[AuthContext] Discarding fallback profile; persisting existing real profile identity.');
            return prevProfile;
          }
          return uProfile || null;
        });
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('[AuthContext] Session resolution encountered a hard stall/timeout:', err);
      // Defensively keep the previous profile if it exists rather than breaking the user UI.
      setProfile(prev => prev || null);
    } finally {
      // Regardless of success/failure, NEVER hold the user hostage.
      // Force UI resolution instantly.
      isInitializingState.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 0. Handle tab visibility changes to cleanly recover dead sessions in the background
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[AuthContext] Tab became visible, verifying background session bounds...');
        const valid = await authService.handleSessionRecovery();
        if (!valid) {
          console.warn('[AuthContext] Background recovery explicitly blocked; logging out securely.');
          await authService.signOut();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 1. Initial manual fetch on mount to guarantee the app has the latest session state
    const initSession = async () => {
      console.log('[AuthContext] Starting initial session check...');
      try {
        const fetchPromise = authService.getValidSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initial session fetch timeout limit reached')), 8000)
        );
        const initSessionData = await Promise.race([fetchPromise, timeoutPromise]);
        await resolveSession(initSessionData, 'mount_initialization');
      } catch (err) {
        console.error('[AuthContext] Init session timed out or failed abruptly:', err);
        // Force a resolution to un-stick the loading screen
        await resolveSession(null, 'mount_failed_timeout');
      }
    };

    initSession();

    // 2. Subscribe to Supabase auth events (handled automatically by gotrue-js)
    // This catches token refreshes, logouts across other tabs, and manual sign-ins.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null;
        console.log('[AuthContext] onAuthStateChange event fired:', event, 'user:', u?.email ?? 'none');

        switch (event) {
          case 'INITIAL_SESSION':
            // Often already handled by the manual initSession() above, but we honor it gracefully.
            if (isInitializingState.current) {
              await resolveSession(session, 'INITIAL_SESSION');
            }
            break;

          case 'SIGNED_IN':
            if (!isInitializingState.current && !currentUserRef.current) {
              // Explicitly bypass loading spinner if evaluating a background recovery
              // Only block UI for a fresh login.
              setLoading(true);
            }
            await resolveSession(session, 'SIGNED_IN');
            break;

          case 'USER_UPDATED':
            setUser(u);
            if (u) {
              // Silent background update
              const p = await authService.fetchUserProfile(u.id, 'USER_UPDATED');
              setProfile(p);
            }
            break;

          case 'TOKEN_REFRESHED':
            // Access token updated in background, keep user state intact
            setUser(u);
            break;

          case 'SIGNED_OUT':
            setUser(null);
            setProfile(null);
            setLoading(false);
            break;

          default:
            break;
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resolveSession]);

  const logout = useCallback(async () => {
    // Rely on the authService for actual API execution,
    // the UI state will flush reactively when the SIGNED_OUT event fires above.
    await authService.signOut();
  }, []);

  // Loading spinner matches existing Arabic RTL UI guidelines
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
        <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>جارٍ التحقق من الجلسة ومصادقة الحساب...</p>
      </div>
    );
  }

  // The 'authError' boundary screen was removed. 
  // If no session exists, the app renders, user=null, and App.jsx `<ProtectedRoute>` easily bumps them to `/login`.
  // The UI no longer intercepts with dead-end error screens over background network hiccups.

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
