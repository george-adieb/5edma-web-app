import {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

// ─── Tuneable constants ────────────────────────────────────────────────────
// Longer timeout gives suspended/slow-connection tabs more headroom
const AUTH_TIMEOUT_MS = 15_000;

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [authError, setAuthError] = useState(null);

  // ── Refs (safe to read inside event handlers without stale closures) ──────
  const resolvedRef       = useRef(false);   // has auth resolved at least once?
  const timeoutRef        = useRef(null);    // the running safety-net timer
  const subscriptionRef   = useRef(null);    // Supabase onAuthStateChange sub
  const inBgRef           = useRef(false);   // is the tab currently hidden?
  const timedOutInBgRef   = useRef(false);   // did the timer fire while hidden?

  // Mirror state → refs so that the visibilitychange handler always reads
  // the latest values without needing to be re-registered on every render.
  const userRef    = useRef(null);
  const profileRef = useRef(null);
  const loadingRef = useRef(true);

  // Wrapped setters that keep refs in sync
  const _setUser    = useCallback((u) => { userRef.current    = u; setUser(u);    }, []);
  const _setProfile = useCallback((p) => { profileRef.current = p; setProfile(p); }, []);
  const _setLoading = useCallback((l) => { loadingRef.current = l; setLoading(l); }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function clearTimer() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  const resolveLoading = useCallback(() => {
    clearTimer();
    _setLoading(false);
  }, [_setLoading]);

  // ── Profile fetch (safe to retry) ────────────────────────────────────────
  const fetchProfile = useCallback(async (userId, source = '') => {
    console.log(`[Auth] fetchProfile START (${source || 'init'}) user:`, userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      console.log('[Auth] fetchProfile SUCCESS');
      _setProfile(data);
      return data;
    } catch (err) {
      console.warn('[Auth] fetchProfile FAILED:', err.message);
      _setProfile(null);
      return null;
    }
  }, [_setProfile]);

  // ── Session resolver (shared by init and resume paths) ───────────────────
  const resolveSession = useCallback(async (session, source) => {
    const u = session?.user ?? null;
    console.log(`[Auth] resolveSession (${source}) → user: ${u?.email ?? 'none'}`);
    _setUser(u);
    if (u) await fetchProfile(u.id, source);
    resolveLoading();
  }, [_setUser, fetchProfile, resolveLoading]);

  // ── Start or restart the safety-net timer ────────────────────────────────
  const startTimer = useCallback((ms = AUTH_TIMEOUT_MS) => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      if (resolvedRef.current) return; // already handled

      if (document.hidden) {
        // Tab is suspended while the timer fires — don't kill a valid session.
        // The visibilitychange handler will kick off a fresh attempt on resume.
        console.warn('[Auth] Safety timer fired while tab is hidden — deferring to resume');
        timedOutInBgRef.current = true;
        return;
      }

      // Timer fired while the tab is visible → genuine auth failure
      console.warn('[Auth] Safety timer fired (foreground) — aborting auth');
      resolvedRef.current = true;
      _setUser(null);
      _setProfile(null);
      setAuthError('انتهت مهلة التحقق من الجلسة. يرجى تسجيل الدخول مجدداً.');
      _setLoading(false);
    }, ms);
  }, [_setUser, _setProfile, _setLoading]);

  // ── Core auth initializer (callable multiple times safely) ───────────────
  const initAuth = useCallback(async (source = 'init') => {
    console.log(`[Auth] initAuth START (${source})`);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      console.log(`[Auth] getSession (${source}):`, session ? 'session found' : 'no session');

      if (!resolvedRef.current) {
        resolvedRef.current = true;
        await resolveSession(session, source);
      }
    } catch (err) {
      console.error(`[Auth] getSession error (${source}):`, err.message);
      if (!resolvedRef.current) {
        resolvedRef.current = true;
        resolveLoading();
      }
    }
  }, [resolveSession, resolveLoading]);

  // ── Visibility-change handler ─────────────────────────────────────────────
  // Registered once on mount — reads refs so it never has stale closures.
  const handleVisibilityChange = useCallback(async () => {
    if (document.hidden) {
      // ── Tab going to background ──
      inBgRef.current = true;
      console.log('[Auth] Tab hidden — pausing safety timer');
      // Don't clear the timer entirely — if it fires while hidden, we
      // catch it via the document.hidden check inside the callback above.
    } else {
      // ── Tab returned from background ──
      console.log(
        '[Auth] Tab visible again.',
        'loading:', loadingRef.current,
        'timedOutInBg:', timedOutInBgRef.current,
        'user:', userRef.current?.email ?? 'none',
      );
      inBgRef.current      = false;

      if (timedOutInBgRef.current || (loadingRef.current && !resolvedRef.current)) {
        // The timer fired while we were in the background, OR we were still
        // loading when the tab was hidden — either way, retry cleanly.
        console.log('[Auth] Retrying auth after resume');
        timedOutInBgRef.current = false;
        resolvedRef.current     = false;
        setAuthError(null);
        _setLoading(true);
        startTimer(AUTH_TIMEOUT_MS);
        await initAuth('resume-retry');

      } else if (!loadingRef.current && authError !== null) {
        // There was a visible error before backgrounding — also retry.
        // (covers the edge case where error was set, then user went away and back)
        console.log('[Auth] Had auth error before background — retrying on resume');
        timedOutInBgRef.current = false;
        resolvedRef.current     = false;
        setAuthError(null);
        _setLoading(true);
        startTimer(AUTH_TIMEOUT_MS);
        await initAuth('resume-error-retry');

      } else if (userRef.current) {
        // Already authenticated — verify the session is still alive (token
        // may have expired while the device was locked/asleep).
        console.log('[Auth] Verifying session validity after resume');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.log('[Auth] Session expired on resume — signing out');
            _setUser(null);
            _setProfile(null);
          } else if (!profileRef.current && session.user) {
            // Profile fetch was interrupted before the tab was hidden — retry it.
            console.log('[Auth] Profile missing after resume — retrying fetch');
            await fetchProfile(session.user.id, 'resume-profile-retry');
          } else {
            console.log('[Auth] Session still valid after resume');
          }
        } catch (err) {
          console.error('[Auth] Session verify after resume failed:', err.message);
        }
      }
    }
  // ⚠ This function intentionally has NO dep-array deps — it reads everything
  // from refs and setters that never change identity, so it only needs to be
  // created once and registered once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── One-time mount setup ──────────────────────────────────────────────────
  useEffect(() => {
    // Clean up any leftover subscription from React Strict Mode first-render
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    resolvedRef.current     = false;
    timedOutInBgRef.current = false;
    inBgRef.current         = document.hidden;

    // Only start the timer if we're currently visible; if the app opens in a
    // background tab, skip the timer until the visibilitychange fires.
    if (!document.hidden) {
      startTimer();
    } else {
      console.log('[Auth] Mounted while hidden — deferring auth to tab focus');
      timedOutInBgRef.current = true; // treat as "needs init on resume"
    }

    initAuth('mount');

    // Supabase real-time auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null;
        console.log('[Auth] onAuthStateChange:', event, u?.email ?? 'no user');

        switch (event) {
          case 'INITIAL_SESSION':
            if (!resolvedRef.current) {
              resolvedRef.current = true;
              _setUser(u);
              if (u) await fetchProfile(u.id, 'INITIAL_SESSION');
              resolveLoading();
            }
            break;

          case 'SIGNED_IN':
            _setUser(u);
            if (u) await fetchProfile(u.id, 'SIGNED_IN');
            if (!resolvedRef.current) {
              resolvedRef.current = true;
              resolveLoading();
            }
            break;

          case 'USER_UPDATED':
            _setUser(u);
            if (u) fetchProfile(u.id, 'USER_UPDATED'); // fire-and-forget
            break;

          case 'TOKEN_REFRESHED':
            // Token silently refreshed — keep user state; profile is unchanged
            _setUser(u);
            break;

          case 'SIGNED_OUT':
            _setUser(null);
            _setProfile(null);
            resolvedRef.current = true;
            resolveLoading();
            break;

          default:
            break;
        }
      }
    );

    subscriptionRef.current = subscription;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      clearTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      _setUser(null);
      _setProfile(null);
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[Auth] logout error:', err.message);
    }
  }, [_setUser, _setProfile]);

  // ── Loading spinner ───────────────────────────────────────────────────────
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

  // ── Auth error (true failures only — not background timeouts) ─────────────
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
        <p style={{ fontSize: '13px', color: '#9CA3AF', maxWidth: '320px', lineHeight: 1.7 }}>
          انتهت مهلة التحقق من الجلسة. يرجى تسجيل الدخول مجدداً.
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => {
              setAuthError(null);
              resolvedRef.current = false;
              _setLoading(true);
              startTimer();
              initAuth('manual-retry');
            }}
            style={{
              padding: '10px 22px', borderRadius: '8px',
              background: 'transparent', color: '#8B1A1A',
              border: '1.5px solid #8B1A1A',
              cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
              fontWeight: 700, fontSize: '13px',
            }}
          >
            إعادة المحاولة
          </button>
          <button
            onClick={() => { setAuthError(null); window.location.href = '/login'; }}
            style={{
              padding: '10px 24px', borderRadius: '8px',
              background: '#8B1A1A', color: 'white', border: 'none',
              cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
              fontWeight: 700, fontSize: '13px',
              boxShadow: '0 4px 12px rgba(139,26,26,0.25)',
            }}
          >
            تسجيل الدخول
          </button>
        </div>
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
