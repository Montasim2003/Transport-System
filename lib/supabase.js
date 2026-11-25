import { createClient } from '@supabase/supabase-js';

/**
 * ============================================================================
 * [SYSTEM CONFIGURATION & DIU INFRASTRUCTURE SWITCH]
 * ============================================================================
 * [DIU INTEGRATION POINT #1 — UNIVERSITY DATABASE CONNECTION]
 * Connected directly to Supabase PostgreSQL via NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (and Vercel Environment Variables).
 * To migrate permanently to DIU servers, point those env vars to DIU's managed
 * PostgreSQL/Supabase instance or replace `db` methods with DIU REST APIs.
 * ============================================================================
 */
export const FORCE_DEMO_OFFLINE_MODE = false;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isCloudConfigured = Boolean(
  !FORCE_DEMO_OFFLINE_MODE && supabaseUrl && supabaseAnonKey
);

export const supabase = isCloudConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_KEY = 'diu_smart_transport_local_cache_v21';

// Clean initial local cache (only used if offline / env keys missing)
export const INITIAL_LOCAL_STORE = {
  users: [],
  verification_codes: [
    { id: 1, code: '20261001', role: 'student', is_used: false },
    { id: 2, code: '20261002', role: 'student', is_used: false },
    { id: 3, code: '20261003', role: 'student', is_used: false },
    { id: 4, code: '20261004', role: 'student', is_used: false },
    { id: 5, code: '20261005', role: 'student', is_used: false },
    { id: 6, code: 'DRV-8801', role: 'driver', is_used: false },
    { id: 7, code: 'DRV-8802', role: 'driver', is_used: false },
    { id: 8, code: 'CTL-9901', role: 'controller', is_used: false },
    { id: 9, code: 'ADM-DIU-2026', role: 'admin', is_used: false },
  ],
  routes: [
    {
      id: 1,
      name: 'Dhanmondi ↔ DIU Ashulia',
      start_point: 'Dhanmondi 27',
      end_point: 'DIU Smart City',
      schedules: ['07:00 AM', '10:00 AM', '01:30 PM', '04:30 PM'],
      stoppages: [
        { name: 'Dhanmondi 27', offset_min: 0, lat: 23.7516, lng: 90.3761 },
        { name: 'Asad Gate', offset_min: 10, lat: 23.7604, lng: 90.3724 },
        { name: 'Shyamoli Square', offset_min: 18, lat: 23.7745, lng: 90.3654 },
        { name: 'Gabtoli', offset_min: 30, lat: 23.7837, lng: 90.3442 },
        { name: 'Birulia Bridge', offset_min: 48, lat: 23.8542, lng: 90.3315 },
        { name: 'DIU Smart City', offset_min: 60, lat: 23.8769, lng: 90.3202 },
      ],
      status: 'active',
    },
    {
      id: 2,
      name: 'Uttara ↔ DIU Ashulia',
      start_point: 'House Building',
      end_point: 'DIU Smart City',
      schedules: ['07:15 AM', '10:30 AM', '01:30 PM', '04:45 PM'],
      stoppages: [
        { name: 'House Building', offset_min: 0, lat: 23.8759, lng: 90.4005 },
        { name: 'Azampur', offset_min: 8, lat: 23.8682, lng: 90.4001 },
        { name: 'Abdullahpur', offset_min: 18, lat: 23.8794, lng: 90.4012 },
        { name: 'Dhour Beribadh', offset_min: 32, lat: 23.8842, lng: 90.3585 },
        { name: 'DIU Smart City', offset_min: 45, lat: 23.8769, lng: 90.3202 },
      ],
      status: 'active',
    },
    {
      id: 3,
      name: 'Mirpur-10 ↔ DIU Ashulia',
      start_point: 'Mirpur-10 Circle',
      end_point: 'DIU Smart City',
      schedules: ['07:15 AM', '11:00 AM', '01:30 PM', '04:30 PM'],
      stoppages: [
        { name: 'Mirpur-10 Circle', offset_min: 0, lat: 23.8069, lng: 90.3687 },
        { name: 'Mirpur-1', offset_min: 12, lat: 23.7956, lng: 90.3537 },
        { name: 'Beribadh Tin Rasta', offset_min: 25, lat: 23.8221, lng: 90.3418 },
        { name: 'Ashulia Model Town', offset_min: 40, lat: 23.8685, lng: 90.3274 },
        { name: 'DIU Smart City', offset_min: 50, lat: 23.8769, lng: 90.3202 },
      ],
      status: 'active',
    },
    {
      id: 4,
      name: 'Savar ↔ DIU Ashulia',
      start_point: 'Savar Bus Stand',
      end_point: 'DIU Smart City',
      schedules: ['07:30 AM', '01:30 PM', '05:00 PM'],
      stoppages: [
        { name: 'Savar Bus Stand', offset_min: 0, lat: 23.8483, "lng": 90.2577 },
        { name: 'Radio Colony', offset_min: 10, lat: 23.8588, lng: 90.2643 },
        { name: 'Jahangirnagar Gate', offset_min: 20, lat: 23.8797, lng: 90.2692 },
        { name: 'DIU Smart City', offset_min: 35, lat: 23.8769, lng: 90.3202 },
      ],
      status: 'active',
    },
  ],
  buses: [
    {
      id: 1,
      bus_number: 'Bus-01',
      plate_no: 'Dhaka Metro Ba 11-4021',
      route_id: 1,
      driver_id: null,
      status: 'active',
      current_lat: 23.8542,
      current_lng: 90.3315,
      speed_kmh: 42,
      seat_config: { rows: 10, leftCols: 2, rightCols: 2, backBench: false, disabledSeats: [] },
      fitness_expiry: '2027-08-15',
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      bus_number: 'Bus-02',
      plate_no: 'Dhaka Metro Ba 11-4022',
      route_id: 2,
      driver_id: null,
      status: 'active',
      current_lat: 23.8810,
      current_lng: 90.3712,
      speed_kmh: 38,
      seat_config: { rows: 9, leftCols: 2, rightCols: 3, backBench: true, disabledSeats: [] },
      fitness_expiry: '2027-05-20',
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
      bus_number: 'Bus-03',
      plate_no: 'Dhaka Metro Cha 14-8823',
      route_id: 3,
      driver_id: null,
      status: 'active',
      current_lat: 23.8221,
      current_lng: 90.3418,
      speed_kmh: 35,
      seat_config: { rows: 9, leftCols: 1, rightCols: 2, backBench: false, disabledSeats: [] },
      fitness_expiry: '2027-11-10',
      updated_at: new Date().toISOString(),
    },
    {
      id: 4,
      bus_number: 'Bus-04',
      plate_no: 'Dhaka Metro Ba 11-4024',
      route_id: 4,
      driver_id: null,
      status: 'standby',
      current_lat: 23.8769,
      current_lng: 90.3202,
      speed_kmh: 0,
      seat_config: { rows: 8, leftCols: 2, rightCols: 2, backBench: true, disabledSeats: [17, 18] },
      fitness_expiry: '2027-03-01',
      updated_at: new Date().toISOString(),
    },
  ],
  bookings: [],
  sos_alerts: [],
  notices: [],
  audit_logs: [],
};

function readLocalStore() {
  if (typeof window === 'undefined') return structuredClone(INITIAL_LOCAL_STORE);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_LOCAL_STORE));
      return structuredClone(INITIAL_LOCAL_STORE);
    }
    return JSON.parse(raw);
  } catch {
    return structuredClone(INITIAL_LOCAL_STORE);
  }
}

function writeLocalStore(store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

let runtimeOfflineFallback = !isCloudConfigured;

export function getDatabaseMode() {
  return runtimeOfflineFallback ? 'LOCAL_STORAGE' : 'SUPABASE_CLOUD';
}

export const db = {
  async getAll(table, orderBy = 'id', ascending = true) {
    if (!runtimeOfflineFallback && supabase) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order(orderBy, { ascending });
      if (!error && Array.isArray(data)) return data;
      console.warn(`[Supabase getAll ${table}]:`, error?.message);
      if (error?.code === '42P01' || error?.message?.includes('fetch')) {
        runtimeOfflineFallback = true;
      }
    }
    const store = readLocalStore();
    const list = [...(store[table] || [])];
    list.sort((a, b) => {
      const av = a[orderBy] ?? '';
      const bv = b[orderBy] ?? '';
      return ascending ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
    });
    return list;
  },

  async insert(table, payload) {
    if (!runtimeOfflineFallback && supabase) {
      let attemptPayload = { ...payload };
      // Resilient retry loop: if Supabase schema cache lacks an optional column (PGRST204),
      // strip that column (or map password_hash -> password) and retry automatically!
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data, error } = await supabase
          .from(table)
          .insert([attemptPayload])
          .select()
          .single();

        if (!error && data) return { data, error: null };

        if (error?.code === '23505') {
          return { data: null, error: 'Duplicate entry detected (already exists or seat already booked).' };
        }

        // Handle PGRST204: "Could not find the 'batch' column of 'users' in the schema cache"
        const missingMatch = error?.message?.match(/Could not find the '([^']+)' column/);
        if (missingMatch) {
          const missingCol = missingMatch[1];
          if (missingCol === 'password_hash' && attemptPayload.password_hash) {
            attemptPayload.password = attemptPayload.password_hash;
          }
          delete attemptPayload[missingCol];
          continue;
        }

        if (error && !error.message?.includes('fetch') && error.code !== '42P01') {
          return { data: null, error: error.message };
        }
        runtimeOfflineFallback = true;
        break;
      }
    }

    const store = readLocalStore();
    const list = store[table] || [];
    if (table === 'bookings') {
      const conflict = list.find(
        (b) =>
          Number(b.bus_id) === Number(payload.bus_id) &&
          b.schedule_time === payload.schedule_time &&
          b.booking_date === payload.booking_date &&
          Number(b.seat_number) === Number(payload.seat_number)
      );
      if (conflict) {
        return { data: null, error: 'This seat was just booked by another student.' };
      }
    }
    const nextId = list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    const record = { id: nextId, created_at: new Date().toISOString(), ...payload };
    store[table] = [...list, record];
    writeLocalStore(store);
    return { data: record, error: null };
  },

  async update(table, id, patch) {
    if (!runtimeOfflineFallback && supabase) {
      let attemptPatch = { ...patch };
      for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error } = await supabase
          .from(table)
          .update(attemptPatch)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return { data, error: null };
        const missingMatch = error?.message?.match(/Could not find the '([^']+)' column/);
        if (missingMatch) {
          delete attemptPatch[missingMatch[1]];
          continue;
        }
        if (error && !error.message?.includes('fetch') && error.code !== '42P01') {
          return { data: null, error: error.message };
        }
        runtimeOfflineFallback = true;
        break;
      }
    }
    const store = readLocalStore();
    const list = store[table] || [];
    let updated = null;
    store[table] = list.map((item) => {
      if (Number(item.id) === Number(id)) {
        updated = { ...item, ...patch };
        return updated;
      }
      return item;
    });
    writeLocalStore(store);
    return { data: updated, error: null };
  },

  async remove(table, id) {
    if (!runtimeOfflineFallback && supabase) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (!error) return { error: null };
      if (!error.message?.includes('fetch') && error.code !== '42P01') {
        return { error: error.message };
      }
      runtimeOfflineFallback = true;
    }
    const store = readLocalStore();
    store[table] = (store[table] || []).filter((item) => Number(item.id) !== Number(id));
    writeLocalStore(store);
    return { error: null };
  },

  async logAudit(actor, action, details) {
    try {
      await this.insert('audit_logs', {
        actor_name: actor?.name || 'System',
        actor_role: actor?.role || 'system',
        action,
        details,
      });
    } catch {
      // Non-blocking audit log
    }
  },
};
