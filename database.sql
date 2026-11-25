-- ============================================================================
-- DIU SMART TRANSPORT MANAGEMENT SYSTEM — SUPABASE / POSTGRESQL SCHEMA
-- ============================================================================
-- Run this entire script ONCE in Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- It creates all tables with the exact columns needed for Student, Driver,
-- Controller, and Admin registration & login, and reloads the schema cache.
--
-- [DIU PRODUCTION INTEGRATION NOTE]
-- 1. Before official DIU production launch, enable Row Level Security (RLS)
--    and bind policies to DIU SSO / Supabase Auth JWT role claims.
-- 2. Connect DIU Accounts / Transport Office API to insert paid verification
--    codes into `verification_codes`.
-- ============================================================================

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notices CASCADE;
DROP TABLE IF EXISTS sos_alerts CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS buses CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS verification_codes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS TABLE (Stores all self-registered Student, Driver, Controller & Admin accounts)
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  uni_id TEXT UNIQUE,                        -- Student ID (e.g. 241-35-489) or Staff ID
  username TEXT UNIQUE,                      -- Auto-generated or custom username
  name TEXT NOT NULL,
  email TEXT UNIQUE,                         -- DIU Email (e.g. jubair@diu.edu.bd)
  phone TEXT UNIQUE,                         -- Mobile Number (supports direct login)
  password_hash TEXT NOT NULL,               -- SHA-256 encrypted password
  role TEXT NOT NULL CHECK (role IN ('student', 'driver', 'controller', 'admin')),
  -- Student Registration Details
  department TEXT,
  batch TEXT,
  guardian_phone TEXT,
  -- Driver & Helper Registration Details
  license_no TEXT UNIQUE,
  helper_name TEXT,
  helper_phone TEXT,
  home_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VERIFICATION CODES VAULT (Issued by Transport / Accounts Office for Registration)
-- [DIU INTEGRATION POINT]: Connect DIU Student Payment Webhook here to auto-insert
-- 8-digit verification codes upon transport fee payment.
CREATE TABLE verification_codes (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'driver', 'controller', 'admin')),
  assigned_uni_id TEXT,
  assigned_name TEXT,
  is_used BOOLEAN DEFAULT FALSE,
  used_by_email TEXT,
  created_by TEXT DEFAULT 'DIU Transport Office',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROUTES TABLE (Controller can Add / Edit / Delete Routes & Stoppages)
CREATE TABLE routes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_point TEXT NOT NULL,
  end_point TEXT NOT NULL,
  schedules JSONB NOT NULL DEFAULT '["07:30 AM", "01:30 PM", "04:30 PM"]'::jsonb,
  stoppages JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BUSES TABLE (Sequential Bus-01, Bus-02... + Custom Seat Layout + Live GPS)
-- [DIU INTEGRATION POINT]: Connect DIU Bus hardware GPS trackers to update
-- `current_lat`, `current_lng`, and `speed_kmh` every 5 seconds.
CREATE TABLE buses (
  id BIGSERIAL PRIMARY KEY,
  bus_number TEXT UNIQUE NOT NULL,
  plate_no TEXT,
  route_id BIGINT REFERENCES routes(id) ON DELETE SET NULL,
  driver_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'standby' CHECK (status IN ('active', 'standby', 'maintenance')),
  current_lat DOUBLE PRECISION DEFAULT 23.8769,
  current_lng DOUBLE PRECISION DEFAULT 90.3202,
  speed_kmh INTEGER DEFAULT 0,
  seat_config JSONB NOT NULL DEFAULT '{"rows": 10, "leftCols": 2, "rightCols": 2, "backBench": false, "disabledSeats": []}'::jsonb,
  fitness_expiry DATE DEFAULT '2027-06-30',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SEAT BOOKINGS TABLE (Database-level UNIQUE constraint prevents double booking)
CREATE TABLE bookings (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_uni_id TEXT,
  student_dept TEXT,
  student_batch TEXT,
  bus_id BIGINT REFERENCES buses(id) ON DELETE CASCADE,
  route_id BIGINT REFERENCES routes(id) ON DELETE SET NULL,
  schedule_time TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  booking_date DATE DEFAULT CURRENT_DATE,
  qr_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bus_id, schedule_time, booking_date, seat_number)
);

-- 6. LIVE SOS EMERGENCY ALERTS TABLE
CREATE TABLE sos_alerts (
  id BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reporter_name TEXT NOT NULL,
  reporter_role TEXT NOT NULL,
  reporter_phone TEXT,
  reporter_dept TEXT,
  reporter_batch TEXT,
  guardian_phone TEXT,
  bus_id BIGINT REFERENCES buses(id) ON DELETE SET NULL,
  bus_number TEXT,
  category TEXT NOT NULL,
  message TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LIVE BROADCAST NOTICES TABLE
CREATE TABLE notices (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  created_by TEXT DEFAULT 'Transport Controller',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SECURITY AUDIT LOGS TABLE
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Open RLS for smooth prototype testing
-- [DIU PRODUCTION SECURITY]: Enable strict Row Level Security policies before official university launch.
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE routes DISABLE ROW LEVEL SECURITY;
ALTER TABLE buses DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE notices DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INITIAL VERIFICATION CODES (Use these codes to register your own accounts!)
-- Once a Controller or Admin registers, they can generate unlimited new codes.
-- ============================================================================
INSERT INTO verification_codes (code, role, is_used) VALUES
('20261001', 'student', FALSE),
('20261002', 'student', FALSE),
('20261003', 'student', FALSE),
('20261004', 'student', FALSE),
('20261005', 'student', FALSE),
('DRV-8801', 'driver', FALSE),
('DRV-8802', 'driver', FALSE),
('DRV-8803', 'driver', FALSE),
('CTL-9901', 'controller', FALSE),
('CTL-9902', 'controller', FALSE),
('ADM-DIU-2026', 'admin', FALSE);

-- ============================================================================
-- INITIAL CAMPUS ROUTES & BUS FLEET (Editable anytime by Controller)
-- ============================================================================
INSERT INTO routes (name, start_point, end_point, schedules, stoppages) VALUES
(
  'Dhanmondi ↔ DIU Ashulia',
  'Dhanmondi 27',
  'DIU Smart City',
  '["07:00 AM", "10:00 AM", "01:30 PM", "04:30 PM"]'::jsonb,
  '[
    {"name": "Dhanmondi 27", "offset_min": 0, "lat": 23.7516, "lng": 90.3761},
    {"name": "Asad Gate", "offset_min": 10, "lat": 23.7604, "lng": 90.3724},
    {"name": "Shyamoli Square", "offset_min": 18, "lat": 23.7745, "lng": 90.3654},
    {"name": "Gabtoli", "offset_min": 30, "lat": 23.7837, "lng": 90.3442},
    {"name": "Birulia Bridge", "offset_min": 48, "lat": 23.8542, "lng": 90.3315},
    {"name": "DIU Smart City", "offset_min": 60, "lat": 23.8769, "lng": 90.3202}
  ]'::jsonb
),
(
  'Uttara ↔ DIU Ashulia',
  'House Building',
  'DIU Smart City',
  '["07:15 AM", "10:30 AM", "01:30 PM", "04:45 PM"]'::jsonb,
  '[
    {"name": "House Building", "offset_min": 0, "lat": 23.8759, "lng": 90.4005},
    {"name": "Azampur", "offset_min": 8, "lat": 23.8682, "lng": 90.4001},
    {"name": "Abdullahpur", "offset_min": 18, "lat": 23.8794, "lng": 90.4012},
    {"name": "Dhour Beribadh", "offset_min": 32, "lat": 23.8842, "lng": 90.3585},
    {"name": "DIU Smart City", "offset_min": 45, "lat": 23.8769, "lng": 90.3202}
  ]'::jsonb
),
(
  'Mirpur-10 ↔ DIU Ashulia',
  'Mirpur-10 Circle',
  'DIU Smart City',
  '["07:15 AM", "11:00 AM", "01:30 PM", "04:30 PM"]'::jsonb,
  '[
    {"name": "Mirpur-10 Circle", "offset_min": 0, "lat": 23.8069, "lng": 90.3687},
    {"name": "Mirpur-1", "offset_min": 12, "lat": 23.7956, "lng": 90.3537},
    {"name": "Beribadh Tin Rasta", "offset_min": 25, "lat": 23.8221, "lng": 90.3418},
    {"name": "Ashulia Model Town", "offset_min": 40, "lat": 23.8685, "lng": 90.3274},
    {"name": "DIU Smart City", "offset_min": 50, "lat": 23.8769, "lng": 90.3202}
  ]'::jsonb
),
(
  'Savar ↔ DIU Ashulia',
  'Savar Bus Stand',
  'DIU Smart City',
  '["07:30 AM", "01:30 PM", "05:00 PM"]'::jsonb,
  '[
    {"name": "Savar Bus Stand", "offset_min": 0, "lat": 23.8483, "lng": 90.2577},
    {"name": "Radio Colony", "offset_min": 10, "lat": 23.8588, "lng": 90.2643},
    {"name": "Jahangirnagar Gate", "offset_min": 20, "lat": 23.8797, "lng": 90.2692},
    {"name": "DIU Smart City", "offset_min": 35, "lat": 23.8769, "lng": 90.3202}
  ]'::jsonb
);

INSERT INTO buses (bus_number, plate_no, route_id, status, current_lat, current_lng, speed_kmh, seat_config, fitness_expiry) VALUES
('Bus-01', 'Dhaka Metro Ba 11-4021', 1, 'active', 23.8542, 90.3315, 42, '{"rows": 10, "leftCols": 2, "rightCols": 2, "backBench": false, "disabledSeats": []}'::jsonb, '2027-08-15'),
('Bus-02', 'Dhaka Metro Ba 11-4022', 2, 'active', 23.8810, 90.3712, 38, '{"rows": 9, "leftCols": 2, "rightCols": 3, "backBench": true, "disabledSeats": []}'::jsonb, '2027-05-20'),
('Bus-03', 'Dhaka Metro Cha 14-8823', 3, 'active', 23.8221, 90.3418, 35, '{"rows": 9, "leftCols": 1, "rightCols": 2, "backBench": false, "disabledSeats": []}'::jsonb, '2027-11-10'),
('Bus-04', 'Dhaka Metro Ba 11-4024', 4, 'standby', 23.8769, 90.3202, 0, '{"rows": 8, "leftCols": 2, "rightCols": 2, "backBench": true, "disabledSeats": [17, 18]}'::jsonb, '2027-03-01');

INSERT INTO notices (title, message, priority, created_by) VALUES
('DIU Smart Transport System Online', 'Register with your verified code to book seats, track live buses, and access emergency SOS protection.', 'normal', 'DIU Transport Office');

-- Force Supabase PostgREST API to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
