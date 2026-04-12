import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing env vars — some features may not work.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-auth-token',
    // Bypass the Web Locks API to prevent infinite hanging on mobile/background tabs.
    // gotrue-js mimics navigator.locks.request which can take 2 or 3 arguments:
    // (name, callback) OR (name, options, callback). 
    // We dynamically find the callback to avoid "acquire is not a function" errors.
    lock: async (...args) => {
      const callback = args.find(arg => typeof arg === 'function');
      if (callback) return await callback();
    },
  },
});
