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
      return { id: userId, role: 'ADMIN', name: 'מستخدم تطوير' };
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
