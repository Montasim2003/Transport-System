import { createClient } from '@supabase/supabase-js';

export const FORCE_DEMO_OFFLINE_MODE = false;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isCloudConfigured = Boolean(
  !FORCE_DEMO_OFFLINE_MODE && supabaseUrl && supabaseAnonKey
);

export const supabase = isCloudConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const TOKEN_KEY = 'diu_transport_server_token_v4';

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getDatabaseMode() {
  return isCloudConfigured ? 'SUPABASE_ZERO_TRUST' : 'NOT_CONFIGURED';
}

/**
 * 100% Zero-Trust Database Adapter
 * Every sensitive read and EVERY write across all 10 tables passes through
 * authenticated PostgreSQL SECURITY DEFINER RPCs verified by the 256-bit session token.
 */
export const db = {
  async getAll(table, orderBy = 'id', ascending = true) {
    if (!supabase) return [];
    const token = getStoredToken();

    if (table === 'users') return this.getDirectory();
    if (table === 'verification_codes') return this.getVerificationCodes();

    if (table === 'bookings') {
      if (!token) return [];
      const { data, error } = await supabase.rpc('rpc_get_bookings', { p_token: token });
      return !error && Array.isArray(data) ? data : [];
    }
    if (table === 'sos_alerts') {
      if (!token) return [];
      const { data, error } = await supabase.rpc('rpc_get_sos_alerts', { p_token: token });
      return !error && Array.isArray(data) ? data : [];
    }
    if (table === 'audit_logs') {
      if (!token) return [];
      const { data, error } = await supabase.rpc('rpc_get_audit_logs', { p_token: token });
      return !error && Array.isArray(data) ? data : [];
    }

    // Public read-only tables (routes, buses, notices)
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending });
    return !error && Array.isArray(data) ? data : [];
  },

  async insert(table, payload) {
    if (!supabase) return { data: null, error: 'Database not configured.' };
    const token = getStoredToken();

    if (table === 'routes') {
      const { data, error } = await supabase.rpc('rpc_manage_route', { p_token: token, p_action: 'create', p_payload: payload });
      if (error || data?.error) return { data: null, error: error?.message || data?.error };
      return { data: data?.data || null, error: null };
    }
    if (table === 'buses') {
      const { data, error } = await supabase.rpc('rpc_manage_bus', { p_token: token, p_action: 'create', p_payload: payload });
      if (error || data?.error) return { data: null, error: error?.message || data?.error };
      return { data: data?.data || null, error: null };
    }
    if (table === 'sos_alerts') {
      const { data, error } = await supabase.rpc('rpc_create_sos', { p_token: token, p_payload: payload });
      if (error || data?.error) return { data: null, error: error?.message || data?.error };
      return { data: data?.data || null, error: null };
    }
    if (table === 'notices') {
      const { data, error } = await supabase.rpc('rpc_create_notice', {
        p_token: token,
        p_title: payload.title,
        p_message: payload.message,
        p_priority: payload.priority || 'normal',
      });
      if (error || data?.error) return { data: null, error: error?.message || data?.error };
      return { data: data?.data || null, error: null };
    }
    if (table === 'audit_logs') {
      await supabase.rpc('rpc_log_audit', { p_token: token, p_action: payload.action, p_details: payload.details });
      return { data: true, error: null };
    }
    return { data: null, error: `Direct insert on ${table} is disabled by Zero-Trust security.` };
  },

  async update(table, id, patch) {
    if (!supabase) return { data: null, error: 'Database not configured.' };
    const token = getStoredToken();

    if (table === 'routes') {
      const { data, error } = await supabase.rpc('rpc_manage_route', { p_token: token, p_action: 'update', p_id: id, p_payload: patch });
      if (error || data?.error) return { data: null, error: error?.message || data?.error };
      return { data: data?.data || null, error: null };
    }
    if (table === 'buses') {
      const { data, error } = await supabase.rpc('rpc_manage_bus', { p_token: token, p_action: 'update', p_id: id, p_payload: patch });
      if (error || data?.error) return { data: null, error: error?.message || data?.error };
      return { data: data?.data || null, error: null };
    }
    if (table === 'sos_alerts' && patch.status === 'resolved') {
      const { data, error } = await supabase.rpc('rpc_resolve_sos', { p_token: token, p_sos_id: id });
      if (error || data?.error) return { data: null, error: error?.message || data?.error };
      return { data: true, error: null };
    }
    return { data: null, error: `Direct update on ${table} is disabled by Zero-Trust security.` };
  },

  async remove(table, id) {
    if (!supabase) return { error: 'Database not configured.' };
    const token = getStoredToken();

    if (table === 'routes') {
      const { data, error } = await supabase.rpc('rpc_manage_route', { p_token: token, p_action: 'delete', p_id: id });
      return { error: error?.message || data?.error || null };
    }
    if (table === 'buses') {
      const { data, error } = await supabase.rpc('rpc_manage_bus', { p_token: token, p_action: 'delete', p_id: id });
      return { error: error?.message || data?.error || null };
    }
    return { error: `Direct delete on ${table} is disabled by Zero-Trust security.` };
  },

  async getDirectory() {
    const token = getStoredToken();
    if (!supabase || !token) return [];
    const { data, error } = await supabase.rpc('rpc_get_directory', { p_token: token });
    return !error && Array.isArray(data) ? data : [];
  },

  async getVerificationCodes() {
    const token = getStoredToken();
    if (!supabase || !token) return [];
    const { data, error } = await supabase.rpc('rpc_get_verification_codes', { p_token: token });
    return !error && Array.isArray(data) ? data : [];
  },

  async issueFeeCode({ role = 'student', assigned_uni_id = '', assigned_name = '', payment_ref = '', custom_code = '' }) {
    const token = getStoredToken();
    if (!supabase || !token) return { data: null, error: 'Authenticated Admin/Controller session required.' };
    const { data, error } = await supabase.rpc('rpc_issue_fee_code', {
      p_token: token,
      p_role: role,
      p_assigned_uni_id: assigned_uni_id || null,
      p_assigned_name: assigned_name || null,
      p_payment_ref: payment_ref || null,
      p_custom_code: custom_code || null,
    });
    if (error) return { data: null, error: error.message };
    if (data?.error) return { data: null, error: data.error };
    return { data: data?.data || null, error: null };
  },

  async revokeCode(codeId) {
    const token = getStoredToken();
    if (!supabase || !token) return { error: 'Authenticated session required.' };
    const { data, error } = await supabase.rpc('rpc_revoke_verification_code', { p_token: token, p_code_id: codeId });
    return { error: error?.message || data?.error || null };
  },

  async manageDriver(action, payload) {
    const token = getStoredToken();
    if (!supabase || !token) return { data: null, error: 'Authenticated Controller session required.' };
    const { data, error } = await supabase.rpc('rpc_manage_driver', {
      p_token: token, p_action: action, p_driver_id: payload.id || null,
      p_name: payload.name || null, p_phone: payload.phone || null, p_email: payload.email || null,
      p_license_no: payload.license_no || null, p_helper_name: payload.helper_name || null,
      p_helper_phone: payload.helper_phone || null, p_home_address: payload.home_address || null,
      p_password: payload.password || null,
    });
    if (error) return { data: null, error: error.message };
    if (data?.error) return { data: null, error: data.error };
    return { data: data?.data || true, error: null };
  },

  async bookSeat({ bus_id, route_id, schedule_time, seat_number, booking_date }) {
    const token = getStoredToken();
    if (!supabase || !token) return { data: null, error: 'Authenticated Student session required.' };
    const { data, error } = await supabase.rpc('rpc_book_seat', {
      p_token: token, p_bus_id: bus_id, p_route_id: route_id,
      p_schedule_time: schedule_time, p_seat_number: seat_number, p_booking_date: booking_date,
    });
    if (error) return { data: null, error: error.message };
    if (data?.error) return { data: null, error: data.error };
    return { data: data?.data || null, error: null };
  },

  async cancelBooking(bookingId) {
    const token = getStoredToken();
    if (!supabase || !token) return { error: 'Authenticated Student session required.' };
    const { data, error } = await supabase.rpc('rpc_cancel_booking', { p_token: token, p_booking_id: bookingId });
    return { error: error?.message || data?.error || null };
  },

  async logAudit(_actor, action, details) {
    try {
      const token = getStoredToken();
      if (supabase && token) {
        await supabase.rpc('rpc_log_audit', { p_token: token, p_action: action, p_details: details });
      }
    } catch {}
  },
};
