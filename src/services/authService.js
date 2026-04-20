import { supabase } from '../lib/supabase';

class AuthService {
  /**
   * Safe wrapper around session retrieval that inherently triggers
   * the underlying gotrue-js refresh mechanism if the token has expired
   * during a suspended tab state.
   *
   * Future-proof: Can be expanded to aggressively check `exp` claims 
   * manually if the built-in Supabase auto-refresh falters further.
   */
  async getValidSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[AuthService] getSession encountered an error:', error.message);
        return null;
      }

      if (!data.session) {
        console.log('[AuthService] No valid session exists.');
        return null;
      }

      return data.session;
    } catch (err) {
      console.error('[AuthService] Unexpected error getting session:', err);
      return null;
    }
  }

  /** Retrieve the raw current access token */
  async getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  /** Force a deliberate token refresh. Throws an error if unsuccessful. */
  async refreshToken() {
    console.log('[AuthService] Attempting manual token refresh...');
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return data.session;
  }

  /**
   * Determine if token is expired by manually decoding the JWT payload
   * and comparing to the current time.
   */
  isTokenExpired(token) {
    if (!token) return true;
    try {
      // Payload is base64 encoded as 2nd part of JWT natively
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
      
      // Buffer of 10 seconds before exact death
      return payload.exp * 1000 <= Date.now() + 10000;
    } catch (e) {
      console.error('[AuthService] Failed to parse JWT to check expiration', e);
      return true; // Safer to assume dead if it is malformed
    }
  }

  /**
   * Orchestrates checking and recovering the session.
   * Meant for background processes and visibility change listeners.
   */
  async handleSessionRecovery() {
    console.log('[AuthService] Running session recovery check...');
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      
      if (!session) {
        console.warn('[AuthService] No session found during recovery check.');
        return false;
      }

      const expired = this.isTokenExpired(session.access_token);
      if (expired) {
        console.warn('[AuthService] Token discovered expired in background! Forcing refresh...');
        await this.refreshToken();
      } else {
        console.log('[AuthService] Session natively validated cleanly. No refresh needed.');
      }
      return true;
    } catch (err) {
      console.error('[AuthService] handleSessionRecovery completely failed:', err.message);
      return false;
    }
  }

  /**
   * Fetches the user profile needed to determine roles and permissions inside the app.
   * Gracefully degrades to a mock ADMIN profile to support local development if the 
   * profiles table is missing or unseeded for the logged-in user.
   */
  async fetchUserProfile(userId, source = 'authService') {
    console.log(`[AuthService] fetchUserProfile START (${source}) for user:`, userId);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      console.log('[AuthService] fetchUserProfile SUCCESS');
      return data;
      
    } catch (err) {
      console.warn('[AuthService] fetchUserProfile FAILED:', err.message, '— Using fallback ADMIN profile for development.');
      // Prevent blocking developers if their profile hasn't been seeded yet.
      // Tagged as isFallback so the frontend actively avoids overwriting good profile data with it.
      return { id: userId, role: 'ADMIN', full_name: 'مستخدم تطوير', name: 'مستخدم تطوير', isFallback: true };
    }
  }

  /**
   * Encapsulate signing out the user
   */
  async signOut() {
    try {
      await supabase.auth.signOut();
      return true;
    } catch (err) {
      console.error('[AuthService] signOut error:', err.message);
      return false;
    }
  }
}

export const authService = new AuthService();
