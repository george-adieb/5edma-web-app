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

  // We use this ref to track if we're currently initializing the session
  // to avoid race conditions with the onAuthStateChange events firing simultaneously on mount.
  const isInitializingState = useRef(true);

  const resolveSession = useCallback(async (session, source) => {
    try {
      const u = session?.user ?? null;
      console.log(`[AuthContext] resolving session (${source}):`, u?.email ?? 'none');
      
      setUser(u);
      
      if (u) {
        const uProfile = await authService.fetchUserProfile(u.id, source);
        setProfile(uProfile);
      } else {
        setProfile(null);
      }
    } finally {
      // Regardless of success/failure of fetching the profile,
      // the authentication initialization cycle finishes here and allows the app to render.
      isInitializingState.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial manual fetch on mount to guarantee the app has the latest session state
    // before any protected components attempt to render.
    const initSession = async () => {
      console.log('[AuthContext] Starting initial session check...');
      const initSessionData = await authService.getValidSession();
      await resolveSession(initSessionData, 'mount_initialization');
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
            if (!isInitializingState.current) {
              // Set loading to true while we fetch their profile since it's a new login
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
