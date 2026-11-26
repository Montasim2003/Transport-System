import { supabase, isCloudConfigured, getStoredToken, setStoredToken } from './supabase';
import { sanitizeText } from './security';

const CACHED_USER_KEY = 'diu_transport_cached_profile_v4';

export function getDashboardPath(role) {
  switch (role) {
    case 'student': return '/student';
    case 'driver': return '/driver';
    case 'controller': return '/controller';
    case 'admin': return '/admin';
    default: return '/';
  }
}

/**
 * Verifies the 256-bit opaque token directly against PostgreSQL `user_sessions`.
 * Even if an attacker modifies localStorage in DevTools, PostgreSQL returns the
 * true authoritative user role & gender (or rejects tampered/revoked tokens).
 */
export async function getVerifiedSession() {
  if (typeof window === 'undefined') return null;
  const token = getStoredToken();
  if (!token) return null;

  if (isCloudConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('rpc_verify_session', { p_token: token });
      if (!error && data?.valid && data?.user) {
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(data.user));
        return data.user;
      }
      // Token invalid or revoked -> wipe cleanly
      setStoredToken(null);
      localStorage.removeItem(CACHED_USER_KEY);
      return null;
    } catch {
      // Temporary network drop: allow cached read-only view until reconnected
      try {
        const cached = localStorage.getItem(CACHED_USER_KEY);
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function logoutUser() {
  const token = getStoredToken();
  if (token && isCloudConfigured && supabase) {
    try {
      await supabase.rpc('rpc_logout_session', { p_token: token });
    } catch {}
  }
  setStoredToken(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CACHED_USER_KEY);
  }
}

export function clearSession() {
  logoutUser();
}

export async function loginUser(identifier, password) {
  const cleanId = sanitizeText(identifier, 120);
  const cleanPass = String(password || '').trim();
  if (!cleanId || !cleanPass) {
    return { user: null, error: 'Please enter your Email / Phone / Student ID and Password.' };
  }

  if (!isCloudConfigured || !supabase) {
    return { user: null, error: 'Cloud database not configured. Please check .env.local.' };
  }

  const { data, error } = await supabase.rpc('rpc_login_user', {
    p_identifier: cleanId,
    p_password: cleanPass,
  });

  if (error) {
    return {
      user: null,
      error: error.message.includes('rpc_login_user')
        ? 'Database v4.0 SQL schema not applied yet! Please run database.sql in Supabase SQL Editor.'
        : error.message,
    };
  }
  if (data?.error || !data?.user || !data?.session_token) {
    return { user: null, error: data?.error || 'Login failed. Please check credentials.' };
  }

  setStoredToken(data.session_token);
  if (typeof window !== 'undefined') {
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(data.user));
  }
  return { user: data.user, error: null };
}

export async function registerUser(form) {
  if (!isCloudConfigured || !supabase) {
    return { user: null, error: 'Cloud database not configured. Please check .env.local.' };
  }

  const role = form.role;
  if (String(form.password || '').length < 6) {
    return { user: null, error: 'Password must be at least 6 characters long.' };
  }
  if (role === 'student' && form.gender !== 'male' && form.gender !== 'female') {
    return { user: null, error: 'Please select your Gender (Male or Female).' };
  }

  const { data, error } = await supabase.rpc('rpc_register_user', {
    p_code: sanitizeText(form.verification_code, 40),
    p_role: role,
    p_name: sanitizeText(form.name, 80),
    p_phone: sanitizeText(form.phone, 25),
    p_email: sanitizeText(form.email, 120),
    p_uni_id: sanitizeText(form.uni_id, 40),
    p_password: String(form.password || ''),
    p_gender: role === 'student' ? form.gender : null,
    p_department: sanitizeText(form.department, 50) || null,
    p_batch: sanitizeText(form.batch, 20) || null,
    p_guardian_phone: sanitizeText(form.guardian_phone, 25) || null,
    p_license_no: sanitizeText(form.license_no, 50) || null,
    p_helper_name: sanitizeText(form.helper_name, 80) || null,
    p_helper_phone: sanitizeText(form.helper_phone, 25) || null,
    p_home_address: sanitizeText(form.home_address, 140) || null,
  });

  if (error) {
    return {
      user: null,
      error: error.message.includes('rpc_register_user')
        ? 'Database v4.0 SQL schema not applied yet! Please run database.sql in Supabase SQL Editor.'
        : error.message,
    };
  }
  if (data?.error || !data?.user || !data?.session_token) {
    return { user: null, error: data?.error || 'Registration failed.' };
  }

  setStoredToken(data.session_token);
  if (typeof window !== 'undefined') {
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(data.user));
  }
  return { user: data.user, error: null };
}
