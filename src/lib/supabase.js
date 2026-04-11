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
    // Do NOT override the lock mechanism.
    // The previous custom lock using navigator.locks.request({ ifAvailable: false })
    // caused indefinite blocking: when a lock was already held (e.g. by a concurrent
    // token refresh), the request queued forever → INITIAL_SESSION never fired →
    // loading screen got stuck permanently.
    // Supabase's built-in lock implementation handles this correctly on its own.
  },
});
