import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing env vars — some features may not work.');
}

let isRefreshing = false;

const customFetchInterceptor = async (url, options) => {
  let response = await fetch(url, options);

  // If unauthorized and NOT an auth route itself (to prevent infinite looping)
  if (response.status === 401 && !url.includes('/auth/v1/')) {
    console.warn('[Supabase Fetch] 401 Unauthorized detected. Pausing request to refresh token natively.');

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const { authService } = await import('../services/authService');
        await authService.refreshToken();
        console.log('[Supabase Fetch] Token effectively refreshed globally.');
      } catch (err) {
        console.error('[Supabase Fetch] Background token refresh failed entirely.', err);
      } finally {
        isRefreshing = false;
      }

      // Re-execute request with fresh token
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${data.session.access_token}`,
        };
        response = await fetch(url, options);
      }
    }
  }

  return response;
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-auth-token',
    lock: async (...args) => {
      const callback = args.find(arg => typeof arg === 'function');
      if (callback) return await callback();
    },
  },
  global: {
    fetch: customFetchInterceptor,
  },
});
