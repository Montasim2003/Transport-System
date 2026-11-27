-- ============================================================================
-- DIU SMART TRANSPORT v4.1 — MAXIMUM SECURITY (100% STRICT RLS + ZERO-TRUST)
-- ============================================================================
-- Run this ENTIRE script ONCE in Supabase Dashboard -> SQL Editor -> New Query -> Run.
--
-- SECURITY GUARANTEES (ALL 10 TABLES LOCKED WITH STRICT RLS):
-- 1. ZERO Anonymous Writes on ANY table (`INSERT`/`UPDATE`/`DELETE` blocked on all 10 tables).
-- 2. ZERO Anonymous Reads on sensitive tables (`users`, `verification_codes`, `user_sessions`,
--    `auth_rate_limits`, `bookings`, `sos_alerts`, `audit_logs` return 0 rows to attackers).
-- 3. Accounts 8-Digit Student Fee Code Generator (`rpc_issue_fee_code`):
--    - Cryptographically random 8-digit code (`10000000`-`99999999`) via `gen_random_bytes`.
--    - Guaranteed ZERO OVERLAP (`UNIQUE` + collision check + 1 active code per Student ID).
--    - Strictly 1-time use with atomic `FOR UPDATE` row lock + bound to exact Student ID.
-- 4. Anti-QR-Theft Booking View (`rpc_get_bookings`):
--    - Students ONLY receive their OWN `qr_token` & booking details; other booked seats
--      return only seat numbers (no student names, IDs, or QR tokens exposed).
-- 5. Anti-Spoof SOS (`rpc_create_sos`):
--    - Pulls verified student/driver name, phone & guardian phone directly from DB session.
-- 6. Server-Side Bcrypt (Cost 10), 256-Bit Opaque Sessions, Server Brute-Force Lockout,
--    Role-Escalation Block Trigger & Database-Level Gender-Seat Enforcement Trigger.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS auth_rate_limits CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notices CASCADE;
DROP TABLE IF EXISTS sos_alerts CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS buses CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS verification_codes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS TABLE
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  uni_id TEXT UNIQUE,
  username TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'driver', 'controller', 'admin')),
  gender TEXT CHECK (gender IN ('male', 'female') OR gender IS NULL),
  department TEXT,
  batch TEXT,
  guardian_phone TEXT,
  license_no TEXT UNIQUE,
  helper_name TEXT,
  helper_phone TEXT,
  home_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SERVER-SIDE 256-BIT SESSIONS TABLE
CREATE TABLE user_sessions (
  token TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SERVER-SIDE BRUTE-FORCE RATE LIMITER
CREATE TABLE auth_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  fail_count INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ACCOUNTS / TRANSPORT OFFICE 8-DIGIT VERIFICATION CODE VAULT
CREATE TABLE verification_codes (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'driver', 'controller', 'admin')),
  assigned_uni_id TEXT,
  assigned_name TEXT,
  payment_ref TEXT,
  is_used BOOLEAN DEFAULT FALSE,
  used_by_email TEXT,
  used_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'DIU Accounts / Transport Office',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_unique_active_student_code
ON verification_codes (LOWER(assigned_uni_id))
WHERE assigned_uni_id IS NOT NULL AND TRIM(assigned_uni_id) <> '' AND is_used = FALSE AND role = 'student';

-- 5. ROUTES TABLE
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

-- 6. BUSES TABLE (Default femaleSeats/maleSeats empty -> all seats White until Controller sets)
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
  seat_config JSONB NOT NULL DEFAULT '{"rows": 10, "leftCols": 2, "rightCols": 2, "backBench": false, "disabledSeats": [], "femaleSeats": [], "maleSeats": []}'::jsonb,
  fitness_expiry DATE DEFAULT '2027-06-30',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SEAT BOOKINGS TABLE
CREATE TABLE bookings (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_uni_id TEXT,
  student_gender TEXT,
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

-- 8. LIVE SOS EMERGENCY ALERTS TABLE
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

-- 9. LIVE BROADCAST NOTICES TABLE
CREATE TABLE notices (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  created_by TEXT DEFAULT 'Transport Controller',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. IMMUTABLE SECURITY AUDIT LOGS TABLE
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- KERNEL TRIGGERS: PRIVILEGE ESCALATION BLOCK & GENDER-SEAT ENFORCEMENT
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Role escalation is blocked at database kernel level.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_role_escalation
BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION prevent_role_escalation();

CREATE OR REPLACE FUNCTION enforce_seat_gender_and_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_seat_config JSONB;
  v_student_gender TEXT;
  v_student_role TEXT;
  v_is_disabled BOOLEAN;
  v_is_female_seat BOOLEAN;
  v_is_male_seat BOOLEAN;
BEGIN
  SELECT role, LOWER(COALESCE(gender, '')) INTO v_student_role, v_student_gender
  FROM users WHERE id = NEW.student_id;

  IF v_student_role IS NULL OR v_student_role <> 'student' THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Only verified students can book bus seats.';
  END IF;

  SELECT seat_config INTO v_seat_config FROM buses WHERE id = NEW.bus_id;
  IF v_seat_config IS NULL THEN
    RAISE EXCEPTION 'INVALID_BUS: Selected bus does not exist.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_seat_config->'disabledSeats', '[]'::jsonb)) AS elem
    WHERE elem::INT = NEW.seat_number
  ) INTO v_is_disabled;
  IF v_is_disabled THEN
    RAISE EXCEPTION 'SEAT_UNAVAILABLE: Seat #% is disabled on this bus.', NEW.seat_number;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_seat_config->'femaleSeats', '[]'::jsonb)) AS elem
    WHERE elem::INT = NEW.seat_number
  ) INTO v_is_female_seat;
  IF v_is_female_seat AND v_student_gender <> 'female' THEN
    RAISE EXCEPTION 'GENDER_RESTRICTED: Seat #% is reserved exclusively for Female students.', NEW.seat_number;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_seat_config->'maleSeats', '[]'::jsonb)) AS elem
    WHERE elem::INT = NEW.seat_number
  ) INTO v_is_male_seat;
  IF v_is_male_seat AND v_student_gender <> 'male' THEN
    RAISE EXCEPTION 'GENDER_RESTRICTED: Seat #% is reserved exclusively for Male students.', NEW.seat_number;
  END IF;

  NEW.student_gender := v_student_gender;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_seat_gender
BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION enforce_seat_gender_and_capacity();

-- ============================================================================
-- INTERNAL HELPERS
-- ============================================================================
CREATE OR REPLACE FUNCTION internal_safe_user_json(u users)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'id', u.id, 'uni_id', u.uni_id, 'username', u.username, 'name', u.name,
    'email', u.email, 'phone', u.phone, 'role', u.role, 'gender', u.gender,
    'department', u.department, 'batch', u.batch, 'guardian_phone', u.guardian_phone,
    'license_no', u.license_no, 'helper_name', u.helper_name,
    'helper_phone', u.helper_phone, 'home_address', u.home_address, 'created_at', u.created_at
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION internal_get_session_user(p_token TEXT)
RETURNS users AS $$
DECLARE
  v_user users;
BEGIN
  IF p_token IS NULL OR TRIM(p_token) = '' THEN RETURN NULL; END IF;
  SELECT u.* INTO v_user
  FROM user_sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token = p_token AND s.revoked = FALSE;

  IF v_user.id IS NOT NULL THEN
    UPDATE user_sessions SET last_seen = NOW() WHERE token = p_token;
  END IF;
  RETURN v_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================================
-- AUTH & REGISTRATION RPCs (BCRYPT + SINGLE-USE 8-DIGIT CODE + LOCKOUT)
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_register_user(
  p_code TEXT, p_role TEXT, p_name TEXT, p_phone TEXT, p_email TEXT, p_uni_id TEXT,
  p_password TEXT, p_gender TEXT DEFAULT NULL, p_department TEXT DEFAULT NULL,
  p_batch TEXT DEFAULT NULL, p_guardian_phone TEXT DEFAULT NULL,
  p_license_no TEXT DEFAULT NULL, p_helper_name TEXT DEFAULT NULL,
  p_helper_phone TEXT DEFAULT NULL, p_home_address TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_code_clean TEXT := UPPER(TRIM(COALESCE(p_code, '')));
  v_email_clean TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_phone_clean TEXT := TRIM(COALESCE(p_phone, ''));
  v_uni_clean TEXT := TRIM(COALESCE(p_uni_id, ''));
  v_bucket TEXT := 'reg:' || COALESCE(NULLIF(v_email_clean, ''), NULLIF(v_phone_clean, ''), 'anon');
  v_code_rec verification_codes;
  v_rate auth_rate_limits;
  v_new_user users;
  v_token TEXT;
  v_hash TEXT;
BEGIN
  SELECT * INTO v_rate FROM auth_rate_limits WHERE bucket_key = v_bucket;
  IF v_rate.locked_until IS NOT NULL AND v_rate.locked_until > NOW() THEN
    RETURN jsonb_build_object('error', 'Too many invalid registration attempts. Locked for 5 minutes.');
  END IF;

  IF LENGTH(COALESCE(p_password, '')) < 6 THEN
    RETURN jsonb_build_object('error', 'Password must be at least 6 characters long.');
  END IF;
  IF p_role = 'student' AND LOWER(COALESCE(p_gender, '')) NOT IN ('male', 'female') THEN
    RETURN jsonb_build_object('error', 'Students must select Gender (Male or Female).');
  END IF;

  SELECT * INTO v_code_rec FROM verification_codes
  WHERE UPPER(code) = v_code_clean AND role = p_role FOR UPDATE;

  IF v_code_rec.id IS NULL THEN
    INSERT INTO auth_rate_limits (bucket_key, fail_count, locked_until, updated_at)
    VALUES (v_bucket, 1, NULL, NOW())
    ON CONFLICT (bucket_key) DO UPDATE SET
      fail_count = CASE WHEN auth_rate_limits.locked_until < NOW() THEN 1 ELSE auth_rate_limits.fail_count + 1 END,
      locked_until = CASE WHEN auth_rate_limits.fail_count + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' ELSE NULL END,
      updated_at = NOW();
    INSERT INTO audit_logs (actor_name, actor_role, action, details)
    VALUES ('Security Guard', 'security', 'INVALID_CODE_ATTEMPT', 'Rejected code ' || v_code_clean || ' for ' || p_role);
    RETURN jsonb_build_object('error', 'Invalid ' || UPPER(p_role) || ' verification code. Contact DIU Accounts / Transport Office.');
  END IF;

  IF v_code_rec.is_used THEN
    RETURN jsonb_build_object('error', 'This 8-digit code has already been used. Each code works strictly once.');
  END IF;

  IF p_role = 'student' AND v_code_rec.assigned_uni_id IS NOT NULL AND TRIM(v_code_rec.assigned_uni_id) <> '' THEN
    IF LOWER(TRIM(v_code_rec.assigned_uni_id)) <> LOWER(v_uni_clean) THEN
      INSERT INTO audit_logs (actor_name, actor_role, action, details)
      VALUES ('Security Guard', 'security', 'CODE_ID_MISMATCH_BLOCKED', 'Student ID ' || v_uni_clean || ' tried code bound to ' || v_code_rec.assigned_uni_id);
      RETURN jsonb_build_object('error', 'SECURITY BLOCK: This 8-digit code is issued exclusively for Student ID ' || v_code_rec.assigned_uni_id || '.');
    END IF;
  END IF;

  IF v_email_clean <> '' AND EXISTS (SELECT 1 FROM users WHERE LOWER(email) = v_email_clean) THEN
    RETURN jsonb_build_object('error', 'This email address is already registered. Please sign in.');
  END IF;
  IF v_phone_clean <> '' AND EXISTS (SELECT 1 FROM users WHERE phone = v_phone_clean) THEN
    RETURN jsonb_build_object('error', 'This mobile number is already registered. Please sign in.');
  END IF;
  IF v_uni_clean <> '' AND EXISTS (SELECT 1 FROM users WHERE LOWER(uni_id) = LOWER(v_uni_clean)) THEN
    RETURN jsonb_build_object('error', 'This Student/Staff ID is already registered.');
  END IF;

  v_hash := crypt(p_password, gen_salt('bf', 10));

  INSERT INTO users (
    uni_id, username, name, email, phone, password_hash, role, gender,
    department, batch, guardian_phone, license_no, helper_name, helper_phone, home_address
  ) VALUES (
    NULLIF(v_uni_clean, ''),
    COALESCE(NULLIF(SPLIT_PART(v_email_clean, '@', 1), ''), v_phone_clean) || '_' || SUBSTR(encode(gen_random_bytes(2), 'hex'), 1, 4),
    TRIM(p_name),
    COALESCE(NULLIF(v_email_clean, ''), v_phone_clean || '@driver.diu.edu.bd'),
    NULLIF(v_phone_clean, ''), v_hash, p_role,
    CASE WHEN p_role = 'student' THEN LOWER(p_gender) ELSE NULL END,
    NULLIF(TRIM(COALESCE(p_department, '')), ''), NULLIF(TRIM(COALESCE(p_batch, '')), ''),
    NULLIF(TRIM(COALESCE(p_guardian_phone, '')), ''), NULLIF(TRIM(COALESCE(p_license_no, '')), ''),
    NULLIF(TRIM(COALESCE(p_helper_name, '')), ''), NULLIF(TRIM(COALESCE(p_helper_phone, '')), ''),
    NULLIF(TRIM(COALESCE(p_home_address, '')), '')
  ) RETURNING * INTO v_new_user;

  UPDATE verification_codes SET is_used = TRUE, used_by_email = v_new_user.email, used_at = NOW() WHERE id = v_code_rec.id;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO user_sessions (token, user_id) VALUES (v_token, v_new_user.id);
  DELETE FROM auth_rate_limits WHERE bucket_key = v_bucket;

  INSERT INTO audit_logs (actor_name, actor_role, action, details)
  VALUES (v_new_user.name, v_new_user.role, 'USER_REGISTER', 'Registered via single-use code ' || v_code_clean);

  RETURN jsonb_build_object('user', internal_safe_user_json(v_new_user), 'session_token', v_token);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('error', 'Duplicate account detail detected (Email, Phone, Student ID, or License already exists).');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_login_user(p_identifier TEXT, p_password TEXT)
RETURNS JSONB AS $$
DECLARE
  v_id_clean TEXT := LOWER(TRIM(COALESCE(p_identifier, '')));
  v_bucket TEXT := 'login:' || v_id_clean;
  v_rate auth_rate_limits;
  v_user users;
  v_token TEXT;
BEGIN
  IF v_id_clean = '' OR COALESCE(p_password, '') = '' THEN
    RETURN jsonb_build_object('error', 'Please enter your Email / Phone / ID and Password.');
  END IF;

  SELECT * INTO v_rate FROM auth_rate_limits WHERE bucket_key = v_bucket;
  IF v_rate.locked_until IS NOT NULL AND v_rate.locked_until > NOW() THEN
    RETURN jsonb_build_object('error', 'Security Lockout: Too many failed login attempts. Try again in 5 minutes.');
  END IF;

  SELECT * INTO v_user FROM users
  WHERE LOWER(COALESCE(email, '')) = v_id_clean OR LOWER(COALESCE(phone, '')) = v_id_clean
     OR LOWER(COALESCE(username, '')) = v_id_clean OR LOWER(COALESCE(uni_id, '')) = v_id_clean
     OR LOWER(COALESCE(license_no, '')) = v_id_clean
  LIMIT 1;

  IF v_user.id IS NULL OR crypt(p_password, v_user.password_hash) <> v_user.password_hash THEN
    INSERT INTO auth_rate_limits (bucket_key, fail_count, locked_until, updated_at)
    VALUES (v_bucket, 1, NULL, NOW())
    ON CONFLICT (bucket_key) DO UPDATE SET
      fail_count = CASE WHEN auth_rate_limits.locked_until < NOW() THEN 1 ELSE auth_rate_limits.fail_count + 1 END,
      locked_until = CASE WHEN auth_rate_limits.fail_count + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' ELSE NULL END,
      updated_at = NOW();
    INSERT INTO audit_logs (actor_name, actor_role, action, details)
    VALUES (COALESCE(v_user.name, v_id_clean), COALESCE(v_user.role, 'unknown'), 'FAILED_LOGIN_ATTEMPT', 'Rejected login for: ' || v_id_clean);
    RETURN jsonb_build_object('error', 'Invalid credentials. Please check your Email/Phone/ID and Password.');
  END IF;

  DELETE FROM auth_rate_limits WHERE bucket_key = v_bucket;
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO user_sessions (token, user_id) VALUES (v_token, v_user.id);
  INSERT INTO audit_logs (actor_name, actor_role, action, details)
  VALUES (v_user.name, v_user.role, 'USER_LOGIN', 'Authenticated securely with server session.');

  RETURN jsonb_build_object('user', internal_safe_user_json(v_user), 'session_token', v_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_verify_session(p_token TEXT)
RETURNS JSONB AS $$
DECLARE v_user users;
BEGIN
  v_user := internal_get_session_user(p_token);
  IF v_user.id IS NULL THEN RETURN jsonb_build_object('valid', FALSE, 'user', NULL); END IF;
  RETURN jsonb_build_object('valid', TRUE, 'user', internal_safe_user_json(v_user));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_logout_session(p_token TEXT)
RETURNS VOID AS $$
BEGIN UPDATE user_sessions SET revoked = TRUE WHERE token = p_token; END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================================
-- ACCOUNTS 8-DIGIT UNIQUE CODE GENERATOR RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_issue_fee_code(
  p_token TEXT, p_role TEXT, p_assigned_uni_id TEXT DEFAULT NULL,
  p_assigned_name TEXT DEFAULT NULL, p_payment_ref TEXT DEFAULT NULL, p_custom_code TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_actor users;
  v_uni_clean TEXT := TRIM(COALESCE(p_assigned_uni_id, ''));
  v_code TEXT := UPPER(TRIM(COALESCE(p_custom_code, '')));
  v_bytes BYTEA;
  v_rand_num BIGINT;
  v_tries INT := 0;
  v_created verification_codes;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL OR v_actor.role NOT IN ('admin', 'controller') THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED: Only verified Admin or Controller can generate codes.');
  END IF;
  IF p_role = 'admin' AND v_actor.role <> 'admin' THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED: Only Admin can issue Admin authorization codes.');
  END IF;

  IF p_role = 'student' AND v_uni_clean <> '' THEN
    IF EXISTS (SELECT 1 FROM users WHERE LOWER(uni_id) = LOWER(v_uni_clean)) THEN
      RETURN jsonb_build_object('error', 'Student ID ' || v_uni_clean || ' is already registered in the transport app.');
    END IF;
    IF EXISTS (SELECT 1 FROM verification_codes WHERE LOWER(assigned_uni_id) = LOWER(v_uni_clean) AND is_used = FALSE AND role = 'student') THEN
      RETURN jsonb_build_object('error', 'An active unused 8-digit code already exists for Student ID ' || v_uni_clean || '.');
    END IF;
  END IF;

  IF v_code = '' THEN
    LOOP
      v_tries := v_tries + 1;
      IF v_tries > 60 THEN RETURN jsonb_build_object('error', 'Could not allocate unique code. Please retry.'); END IF;
      v_bytes := gen_random_bytes(4);
      v_rand_num := (get_byte(v_bytes, 0)::BIGINT * 16777216) + (get_byte(v_bytes, 1)::BIGINT * 65536)
                  + (get_byte(v_bytes, 2)::BIGINT * 256) + (get_byte(v_bytes, 3)::BIGINT);
      IF p_role = 'student' THEN v_code := (10000000 + (v_rand_num % 90000000))::TEXT;
      ELSIF p_role = 'driver' THEN v_code := 'DRV-' || (100000 + (v_rand_num % 900000))::TEXT;
      ELSIF p_role = 'controller' THEN v_code := 'CTL-' || (100000 + (v_rand_num % 900000))::TEXT;
      ELSE v_code := 'ADM-' || (100000 + (v_rand_num % 900000))::TEXT;
      END IF;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM verification_codes WHERE UPPER(code) = v_code);
    END LOOP;
  ELSE
    IF EXISTS (SELECT 1 FROM verification_codes WHERE UPPER(code) = v_code) THEN
      RETURN jsonb_build_object('error', 'Code ' || v_code || ' already exists. Zero overlap enforced.');
    END IF;
  END IF;

  INSERT INTO verification_codes (code, role, assigned_uni_id, assigned_name, payment_ref, is_used, created_by)
  VALUES (v_code, p_role, NULLIF(v_uni_clean, ''), NULLIF(TRIM(COALESCE(p_assigned_name, '')), ''), NULLIF(TRIM(COALESCE(p_payment_ref, '')), ''), FALSE, v_actor.name)
  RETURNING * INTO v_created;

  INSERT INTO audit_logs (actor_name, actor_role, action, details)
  VALUES (v_actor.name, v_actor.role, 'FEE_CODE_ISSUED', 'Issued unique code ' || v_code || ' (' || p_role || ') for ID: ' || COALESCE(NULLIF(v_uni_clean, ''), 'General'));
  RETURN jsonb_build_object('data', to_jsonb(v_created));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_get_verification_codes(p_token TEXT)
RETURNS JSONB AS $$
DECLARE v_actor users;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL OR v_actor.role NOT IN ('admin', 'controller') THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id DESC) FROM verification_codes c), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_revoke_verification_code(p_token TEXT, p_code_id BIGINT)
RETURNS JSONB AS $$
DECLARE v_actor users;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL OR v_actor.role NOT IN ('admin', 'controller') THEN RETURN jsonb_build_object('error', 'UNAUTHORIZED'); END IF;
  DELETE FROM verification_codes WHERE id = p_code_id AND is_used = FALSE;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================================
-- ROLE-SCOPED DIRECTORY & DRIVER MANAGEMENT RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_get_directory(p_token TEXT)
RETURNS JSONB AS $$
DECLARE v_actor users;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF v_actor.role = 'admin' THEN
    RETURN COALESCE((SELECT jsonb_agg(internal_safe_user_json(u) ORDER BY u.id ASC) FROM users u), '[]'::jsonb);
  END IF;
  IF v_actor.role = 'controller' THEN
    RETURN COALESCE((SELECT jsonb_agg(internal_safe_user_json(u) ORDER BY u.id ASC) FROM users u WHERE u.role IN ('driver', 'controller')), '[]'::jsonb);
  END IF;
  IF v_actor.role = 'student' THEN
    RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role, 'phone', CASE WHEN u.role = 'controller' THEN u.phone ELSE NULL END) ORDER BY u.id ASC) FROM users u WHERE u.role IN ('controller', 'driver')), '[]'::jsonb);
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role, 'phone', u.phone) ORDER BY u.id ASC) FROM users u WHERE u.role = 'controller'), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_manage_driver(
  p_token TEXT, p_action TEXT, p_driver_id BIGINT DEFAULT NULL, p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL, p_email TEXT DEFAULT NULL, p_license_no TEXT DEFAULT NULL,
  p_helper_name TEXT DEFAULT NULL, p_helper_phone TEXT DEFAULT NULL,
  p_home_address TEXT DEFAULT NULL, p_password TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE v_actor users; v_drv users;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL OR v_actor.role NOT IN ('controller', 'admin') THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED: Controller or Admin access required.');
  END IF;
  IF p_action = 'delete' THEN
    UPDATE buses SET driver_id = NULL WHERE driver_id = p_driver_id;
    DELETE FROM users WHERE id = p_driver_id AND role = 'driver';
    INSERT INTO audit_logs (actor_name, actor_role, action, details) VALUES (v_actor.name, v_actor.role, 'DRIVER_DELETED', 'Removed driver #' || p_driver_id);
    RETURN jsonb_build_object('ok', TRUE);
  END IF;
  IF p_action = 'update' THEN
    UPDATE users SET
      name = TRIM(p_name), phone = TRIM(p_phone),
      email = COALESCE(NULLIF(LOWER(TRIM(COALESCE(p_email, ''))), ''), TRIM(p_phone) || '@driver.diu.edu.bd'),
      license_no = TRIM(p_license_no), helper_name = TRIM(p_helper_name),
      helper_phone = TRIM(p_helper_phone), home_address = TRIM(COALESCE(p_home_address, ''))
    WHERE id = p_driver_id AND role = 'driver' RETURNING * INTO v_drv;
    RETURN jsonb_build_object('data', internal_safe_user_json(v_drv));
  END IF;
  INSERT INTO users (uni_id, username, name, email, phone, password_hash, role, license_no, helper_name, helper_phone, home_address)
  VALUES (
    'DRV-' || SUBSTR(encode(gen_random_bytes(2), 'hex'), 1, 4), TRIM(p_phone), TRIM(p_name),
    COALESCE(NULLIF(LOWER(TRIM(COALESCE(p_email, ''))), ''), TRIM(p_phone) || '@driver.diu.edu.bd'),
    TRIM(p_phone), crypt(COALESCE(NULLIF(p_password, ''), '123456'), gen_salt('bf', 10)),
    'driver', TRIM(p_license_no), TRIM(p_helper_name), TRIM(p_helper_phone), TRIM(COALESCE(p_home_address, ''))
  ) RETURNING * INTO v_drv;
  INSERT INTO audit_logs (actor_name, actor_role, action, details) VALUES (v_actor.name, v_actor.role, 'DRIVER_ADDED', 'Added driver ' || v_drv.name);
  RETURN jsonb_build_object('data', internal_safe_user_json(v_drv));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('error', 'Duplicate driver phone, email, or license number.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================================
-- ANTI-QR-THEFT BOOKING RPCs (READ / BOOK / CANCEL)
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_get_bookings(p_token TEXT)
RETURNS JSONB AS $$
DECLARE v_actor users;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL THEN RETURN '[]'::jsonb; END IF;

  IF v_actor.role IN ('admin', 'controller') THEN
    RETURN COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id ASC) FROM bookings b), '[]'::jsonb);
  END IF;

  -- Students & Drivers see ONLY seat occupancy for other students (NO qr_token or PII leak!)
  RETURN COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN b.student_id = v_actor.id THEN to_jsonb(b)
        ELSE jsonb_build_object(
          'id', b.id, 'bus_id', b.bus_id, 'route_id', b.route_id,
          'schedule_time', b.schedule_time, 'seat_number', b.seat_number,
          'booking_date', b.booking_date
        )
      END ORDER BY b.id ASC
    ) FROM bookings b
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_book_seat(
  p_token TEXT, p_bus_id BIGINT, p_route_id BIGINT,
  p_schedule_time TEXT, p_seat_number INTEGER, p_booking_date DATE
)
RETURNS JSONB AS $$
DECLARE v_student users; v_bus buses; v_qr TEXT; v_booking bookings;
BEGIN
  v_student := internal_get_session_user(p_token);
  IF v_student.id IS NULL OR v_student.role <> 'student' THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED: Please sign in with a valid student session.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM bookings WHERE student_id = v_student.id AND bus_id = p_bus_id
      AND schedule_time = p_schedule_time AND booking_date = p_booking_date
  ) THEN
    RETURN jsonb_build_object('error', 'You already hold a seat on this trip. Cancel it first to change seats.');
  END IF;

  SELECT * INTO v_bus FROM buses WHERE id = p_bus_id;
  v_qr := 'DIU-' || COALESCE(v_bus.bus_number, 'BUS') || '-S' || p_seat_number || '-' || COALESCE(v_student.uni_id, v_student.id::TEXT) || '-' || UPPER(SUBSTR(encode(gen_random_bytes(3), 'hex'), 1, 6));

  INSERT INTO bookings (
    student_id, student_name, student_uni_id, student_gender, student_dept, student_batch,
    bus_id, route_id, schedule_time, seat_number, booking_date, qr_token
  ) VALUES (
    v_student.id, v_student.name, v_student.uni_id, v_student.gender, v_student.department, v_student.batch,
    p_bus_id, p_route_id, p_schedule_time, p_seat_number, p_booking_date, v_qr
  ) RETURNING * INTO v_booking;

  INSERT INTO audit_logs (actor_name, actor_role, action, details)
  VALUES (v_student.name, 'student', 'SEAT_BOOKED', 'Booked Seat #' || p_seat_number || ' on ' || COALESCE(v_bus.bus_number, 'Bus') || ' (' || p_schedule_time || ')');
  RETURN jsonb_build_object('data', to_jsonb(v_booking));
EXCEPTION
  WHEN unique_violation THEN RETURN jsonb_build_object('error', 'Seat #' || p_seat_number || ' was just booked by another student.');
  WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_cancel_booking(p_token TEXT, p_booking_id BIGINT)
RETURNS JSONB AS $$
DECLARE v_student users;
BEGIN
  v_student := internal_get_session_user(p_token);
  IF v_student.id IS NULL THEN RETURN jsonb_build_object('error', 'UNAUTHORIZED'); END IF;
  DELETE FROM bookings WHERE id = p_booking_id AND student_id = v_student.id;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================================
-- AUTHENTICATED FLEET, ROUTE, SOS, NOTICE & AUDIT RPCs (ZERO ANON WRITES!)
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_manage_route(p_token TEXT, p_action TEXT, p_id BIGINT DEFAULT NULL, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE v_actor users; v_rec routes;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL OR v_actor.role NOT IN ('controller', 'admin') THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED: Only Controller can modify routes or stoppages.');
  END IF;
  IF p_action = 'delete' THEN
    DELETE FROM routes WHERE id = p_id;
    RETURN jsonb_build_object('ok', TRUE);
  ELSIF p_action = 'update' THEN
    UPDATE routes SET
      name = COALESCE(p_payload->>'name', name),
      start_point = COALESCE(p_payload->>'start_point', start_point),
      end_point = COALESCE(p_payload->>'end_point', end_point),
      schedules = COALESCE(p_payload->'schedules', schedules),
      stoppages = COALESCE(p_payload->'stoppages', stoppages)
    WHERE id = p_id RETURNING * INTO v_rec;
    RETURN jsonb_build_object('data', to_jsonb(v_rec));
  ELSE
    INSERT INTO routes (name, start_point, end_point, schedules, stoppages, status)
    VALUES (
      p_payload->>'name', p_payload->>'start_point', COALESCE(p_payload->>'end_point', 'DIU Smart City'),
      COALESCE(p_payload->'schedules', '["07:30 AM", "01:30 PM"]'::jsonb),
      COALESCE(p_payload->'stoppages', '[]'::jsonb), 'active'
    ) RETURNING * INTO v_rec;
    RETURN jsonb_build_object('data', to_jsonb(v_rec));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_manage_bus(p_token TEXT, p_action TEXT, p_id BIGINT DEFAULT NULL, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE v_actor users; v_rec buses;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL THEN RETURN jsonb_build_object('error', 'UNAUTHORIZED'); END IF;

  -- Drivers can ONLY update live GPS coordinates, speed & active/standby status
  IF v_actor.role = 'driver' THEN
    IF p_action <> 'update' THEN
      RETURN jsonb_build_object('error', 'UNAUTHORIZED: Drivers can only update live GPS telemetry.');
    END IF;
    UPDATE buses SET
      current_lat = COALESCE((p_payload->>'current_lat')::DOUBLE PRECISION, current_lat),
      current_lng = COALESCE((p_payload->>'current_lng')::DOUBLE PRECISION, current_lng),
      speed_kmh = COALESCE((p_payload->>'speed_kmh')::INTEGER, speed_kmh),
      status = CASE WHEN p_payload->>'status' IN ('active', 'standby') THEN p_payload->>'status' ELSE status END,
      updated_at = NOW()
    WHERE id = p_id RETURNING * INTO v_rec;
    RETURN jsonb_build_object('data', to_jsonb(v_rec));
  END IF;

  IF v_actor.role NOT IN ('controller', 'admin') THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED: Controller access required.');
  END IF;

  IF p_action = 'delete' THEN
    DELETE FROM buses WHERE id = p_id;
    RETURN jsonb_build_object('ok', TRUE);
  ELSIF p_action = 'update' THEN
    UPDATE buses SET
      route_id = CASE WHEN p_payload ? 'route_id' THEN NULLIF(p_payload->>'route_id', '')::BIGINT ELSE route_id END,
      driver_id = CASE WHEN p_payload ? 'driver_id' THEN NULLIF(p_payload->>'driver_id', '')::BIGINT ELSE driver_id END,
      status = COALESCE(p_payload->>'status', status),
      seat_config = COALESCE(p_payload->'seat_config', seat_config),
      current_lat = COALESCE((p_payload->>'current_lat')::DOUBLE PRECISION, current_lat),
      current_lng = COALESCE((p_payload->>'current_lng')::DOUBLE PRECISION, current_lng),
      speed_kmh = COALESCE((p_payload->>'speed_kmh')::INTEGER, speed_kmh),
      updated_at = NOW()
    WHERE id = p_id RETURNING * INTO v_rec;
    RETURN jsonb_build_object('data', to_jsonb(v_rec));
  ELSE
    INSERT INTO buses (bus_number, plate_no, route_id, driver_id, status, current_lat, current_lng, speed_kmh, seat_config, fitness_expiry)
    VALUES (
      p_payload->>'bus_number',
      COALESCE(p_payload->>'plate_no', 'Dhaka Metro Ba 11-XXXX'),
      NULLIF(p_payload->>'route_id', '')::BIGINT,
      NULLIF(p_payload->>'driver_id', '')::BIGINT,
      COALESCE(p_payload->>'status', 'standby'),
      COALESCE((p_payload->>'current_lat')::DOUBLE PRECISION, 23.8769),
      COALESCE((p_payload->>'current_lng')::DOUBLE PRECISION, 90.3202),
      0,
      COALESCE(p_payload->'seat_config', '{"rows": 10, "leftCols": 2, "rightCols": 2, "backBench": false, "disabledSeats": [], "femaleSeats": [], "maleSeats": []}'::jsonb),
      COALESCE(NULLIF(p_payload->>'fitness_expiry', '')::DATE, DATE '2027-12-31')
    ) RETURNING * INTO v_rec;
    RETURN jsonb_build_object('data', to_jsonb(v_rec));
  END IF;
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('error', 'Bus number already exists.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_get_sos_alerts(p_token TEXT)
RETURNS JSONB AS $$
DECLARE v_actor users;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL OR v_actor.role NOT IN ('controller', 'admin') THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id DESC) FROM sos_alerts s), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_create_sos(p_token TEXT, p_payload JSONB)
RETURNS JSONB AS $$
DECLARE v_actor users; v_rec sos_alerts;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL THEN RETURN jsonb_build_object('error', 'UNAUTHORIZED'); END IF;

  INSERT INTO sos_alerts (
    reporter_id, reporter_name, reporter_role, reporter_phone, reporter_dept, reporter_batch,
    guardian_phone, bus_id, bus_number, category, message, lat, lng, status
  ) VALUES (
    v_actor.id,
    CASE WHEN v_actor.role = 'driver' THEN v_actor.name || ' (Driver)' ELSE v_actor.name END,
    v_actor.role,
    COALESCE(v_actor.phone, 'N/A'),
    v_actor.department,
    v_actor.batch,
    CASE WHEN v_actor.role = 'driver' THEN 'Helper: ' || COALESCE(v_actor.helper_name, 'N/A') || ' (' || COALESCE(v_actor.helper_phone, 'N/A') || ')' ELSE COALESCE(v_actor.guardian_phone, 'Not Provided') END,
    NULLIF(p_payload->>'bus_id', '')::BIGINT,
    COALESCE(p_payload->>'bus_number', 'General Campus'),
    COALESCE(p_payload->>'category', 'Emergency'),
    COALESCE(p_payload->>'message', 'Urgent assistance needed!'),
    COALESCE((p_payload->>'lat')::DOUBLE PRECISION, 23.8769),
    COALESCE((p_payload->>'lng')::DOUBLE PRECISION, 90.3202),
    'active'
  ) RETURNING * INTO v_rec;

  INSERT INTO audit_logs (actor_name, actor_role, action, details)
  VALUES (v_actor.name, v_actor.role, 'SOS_TRIGGERED', 'Triggered ' || v_rec.category || ' on ' || v_rec.bus_number);
  RETURN jsonb_build_object('data', to_jsonb(v_rec));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_resolve_sos(p_token TEXT, p_sos_id BIGINT)
RETURNS JSONB AS $$
DECLARE v_actor users;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL OR v_actor.role NOT IN ('controller', 'admin') THEN RETURN jsonb_build_object('error', 'UNAUTHORIZED'); END IF;
  UPDATE sos_alerts SET status = 'resolved' WHERE id = p_sos_id;
  INSERT INTO audit_logs (actor_name, actor_role, action, details) VALUES (v_actor.name, v_actor.role, 'SOS_RESOLVED', 'Resolved SOS #' || p_sos_id);
  RETURN jsonb_build_object('ok', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_create_notice(p_token TEXT, p_title TEXT, p_message TEXT, p_priority TEXT DEFAULT 'normal')
RETURNS JSONB AS $$
DECLARE v_actor users; v_rec notices;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL OR v_actor.role NOT IN ('controller', 'admin') THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED: Only Controller or Admin can broadcast notices.');
  END IF;
  INSERT INTO notices (title, message, priority, created_by)
  VALUES (TRIM(p_title), TRIM(p_message), CASE WHEN p_priority = 'urgent' THEN 'urgent' ELSE 'normal' END, v_actor.name)
  RETURNING * INTO v_rec;
  INSERT INTO audit_logs (actor_name, actor_role, action, details) VALUES (v_actor.name, v_actor.role, 'NOTICE_BROADCAST', v_rec.title);
  RETURN jsonb_build_object('data', to_jsonb(v_rec));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_get_audit_logs(p_token TEXT)
RETURNS JSONB AS $$
DECLARE v_actor users;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL OR v_actor.role <> 'admin' THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id DESC) FROM (SELECT * FROM audit_logs ORDER BY id DESC LIMIT 150) a), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION rpc_log_audit(p_token TEXT, p_action TEXT, p_details TEXT)
RETURNS VOID AS $$
DECLARE v_actor users;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL THEN RETURN; END IF;
  INSERT INTO audit_logs (actor_name, actor_role, action, details)
  VALUES (v_actor.name, v_actor.role, LEFT(TRIM(COALESCE(p_action, 'ACTION')), 60), LEFT(TRIM(COALESCE(p_details, '')), 250));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================================
-- 100% STRICT ROW LEVEL SECURITY (ALL 10 TABLES LOCKED!)
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- Public READ-ONLY policies ONLY for non-sensitive campus map & notice board
CREATE POLICY "read_only_routes" ON routes FOR SELECT USING (true);
CREATE POLICY "read_only_buses" ON buses FOR SELECT USING (true);
CREATE POLICY "read_only_notices" ON notices FOR SELECT USING (true);
-- ZERO write policies anywhere -> ALL mutations MUST pass authenticated PostgreSQL RPCs!

-- ============================================================================
-- INITIAL BOOTSTRAP CODES (Admin uses ADM-DIU-2026 to register & issue 8-digit Student codes)
-- ============================================================================
INSERT INTO verification_codes (code, role, is_used, created_by) VALUES
('ADM-DIU-2026', 'admin', FALSE, 'System Bootstrap'),
('CTL-9901', 'controller', FALSE, 'System Bootstrap'),
('DRV-8801', 'driver', FALSE, 'System Bootstrap'),
('20261001', 'student', FALSE, 'System Bootstrap');

-- ============================================================================
-- INITIAL CAMPUS ROUTES & BUS FLEET (All seats default to White until Controller assigns)
-- ============================================================================
INSERT INTO routes (name, start_point, end_point, schedules, stoppages) VALUES
('Dhanmondi ↔ DIU Ashulia', 'Dhanmondi 27', 'DIU Smart City', '["07:00 AM", "10:00 AM", "01:30 PM", "04:30 PM"]'::jsonb, '[{"name": "Dhanmondi 27", "offset_min": 0, "lat": 23.7516, "lng": 90.3761}, {"name": "Asad Gate", "offset_min": 10, "lat": 23.7604, "lng": 90.3724}, {"name": "Shyamoli Square", "offset_min": 18, "lat": 23.7745, "lng": 90.3654}, {"name": "Gabtoli", "offset_min": 30, "lat": 23.7837, "lng": 90.3442}, {"name": "Birulia Bridge", "offset_min": 48, "lat": 23.8542, "lng": 90.3315}, {"name": "DIU Smart City", "offset_min": 60, "lat": 23.8769, "lng": 90.3202}]'::jsonb),
('Uttara ↔ DIU Ashulia', 'House Building', 'DIU Smart City', '["07:15 AM", "10:30 AM", "01:30 PM", "04:45 PM"]'::jsonb, '[{"name": "House Building", "offset_min": 0, "lat": 23.8759, "lng": 90.4005}, {"name": "Azampur", "offset_min": 8, "lat": 23.8682, "lng": 90.4001}, {"name": "Abdullahpur", "offset_min": 18, "lat": 23.8794, "lng": 90.4012}, {"name": "Dhour Beribadh", "offset_min": 32, "lat": 23.8842, "lng": 90.3585}, {"name": "DIU Smart City", "offset_min": 45, "lat": 23.8769, "lng": 90.3202}]'::jsonb),
('Mirpur-10 ↔ DIU Ashulia', 'Mirpur-10 Circle', 'DIU Smart City', '["07:15 AM", "11:00 AM", "01:30 PM", "04:30 PM"]'::jsonb, '[{"name": "Mirpur-10 Circle", "offset_min": 0, "lat": 23.8069, "lng": 90.3687}, {"name": "Mirpur-1", "offset_min": 12, "lat": 23.7956, "lng": 90.3537}, {"name": "Beribadh Tin Rasta", "offset_min": 25, "lat": 23.8221, "lng": 90.3418}, {"name": "Ashulia Model Town", "offset_min": 40, "lat": 23.8685, "lng": 90.3274}, {"name": "DIU Smart City", "offset_min": 50, "lat": 23.8769, "lng": 90.3202}]'::jsonb),
('Savar ↔ DIU Ashulia', 'Savar Bus Stand', 'DIU Smart City', '["07:30 AM", "01:30 PM", "05:00 PM"]'::jsonb, '[{"name": "Savar Bus Stand", "offset_min": 0, "lat": 23.8483, "lng": 90.2577}, {"name": "Radio Colony", "offset_min": 10, "lat": 23.8588, "lng": 90.2643}, {"name": "Jahangirnagar Gate", "offset_min": 20, "lat": 23.8797, "lng": 90.2692}, {"name": "DIU Smart City", "offset_min": 35, "lat": 23.8769, "lng": 90.3202}]'::jsonb);

INSERT INTO buses (bus_number, plate_no, route_id, status, current_lat, current_lng, speed_kmh, seat_config, fitness_expiry) VALUES
('Bus-01', 'Dhaka Metro Ba 11-4021', 1, 'active', 23.8542, 90.3315, 42, '{"rows": 10, "leftCols": 2, "rightCols": 2, "backBench": false, "disabledSeats": [], "femaleSeats": [], "maleSeats": []}'::jsonb, '2027-08-15'),
('Bus-02', 'Dhaka Metro Ba 11-4022', 2, 'active', 23.8810, 90.3712, 38, '{"rows": 9, "leftCols": 2, "rightCols": 3, "backBench": true, "disabledSeats": [], "femaleSeats": [], "maleSeats": []}'::jsonb, '2027-05-20'),
('Bus-03', 'Dhaka Metro Cha 14-8823', 3, 'active', 23.8221, 90.3418, 35, '{"rows": 9, "leftCols": 1, "rightCols": 2, "backBench": false, "disabledSeats": [], "femaleSeats": [], "maleSeats": []}'::jsonb, '2027-11-10'),
('Bus-04', 'Dhaka Metro Ba 11-4024', 4, 'standby', 23.8769, 90.3202, 0, '{"rows": 8, "leftCols": 2, "rightCols": 2, "backBench": true, "disabledSeats": [], "femaleSeats": [], "maleSeats": []}'::jsonb, '2027-03-01');

INSERT INTO notices (title, message, priority, created_by) VALUES
('DIU Smart Transport v4.1 Maximum Security Live', 'Protected by 100% All-Table Strict RLS, Server-Side Bcrypt, 256-Bit Sessions & Single-Use 8-Digit Accounts Verification Codes.', 'normal', 'DIU Transport Office');


-- ============================================================================
-- v4.2 CAMPUS DEPARTURE 20-MIN LOCK & TARGETED AREA ALERTS UPGRADE
-- ============================================================================
-- ============================================================================
-- DIU SMART TRANSPORT v4.2 — SAFE UPGRADE PATCH (NO DATA LOSS!)
-- ============================================================================
-- Run this in Supabase SQL Editor -> New Query -> Run.
-- It KEEPS all your existing registered users, 8-digit codes, routes & buses!
--
-- WHAT THIS ADDS:
-- 1. Controller-controlled Campus Departure Time (`departure_time`), Direction
--    (`to_campus` vs `from_campus`) & Booking Window (`booking_window_mins` = 20).
-- 2. Server-side `Asia/Dhaka` Clock Lock inside `rpc_book_seat`:
--    - ONLY enforced when `trip_direction = 'from_campus'` (Leaving DIU Campus).
--    - Blocks booking before `departure_time - 20 minutes` even if student changes phone clock!
-- 3. Student Preferred Stoppage (`preferred_stoppage`) & Targeted Alert Preference.
-- ============================================================================

-- 1. Add columns safely without deleting any existing rows
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_stoppage TEXT,
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE buses
  ADD COLUMN IF NOT EXISTS trip_direction TEXT DEFAULT 'from_campus' CHECK (trip_direction IN ('to_campus', 'from_campus')),
  ADD COLUMN IF NOT EXISTS departure_time TEXT DEFAULT '14:20',
  ADD COLUMN IF NOT EXISTS booking_window_mins INTEGER DEFAULT 20;

-- Set clean realistic initial campus departure times if null
UPDATE buses SET
  trip_direction = COALESCE(trip_direction, 'from_campus'),
  departure_time = COALESCE(departure_time, CASE bus_number
    WHEN 'Bus-01' THEN '14:20'
    WHEN 'Bus-02' THEN '14:40'
    WHEN 'Bus-03' THEN '15:00'
    ELSE '16:30'
  END),
  booking_window_mins = COALESCE(booking_window_mins, 20);

-- 2. Include preferred_stoppage & notifications_enabled in safe user JSON
CREATE OR REPLACE FUNCTION internal_safe_user_json(u users)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'id', u.id, 'uni_id', u.uni_id, 'username', u.username, 'name', u.name,
    'email', u.email, 'phone', u.phone, 'role', u.role, 'gender', u.gender,
    'department', u.department, 'batch', u.batch, 'guardian_phone', u.guardian_phone,
    'license_no', u.license_no, 'helper_name', u.helper_name,
    'helper_phone', u.helper_phone, 'home_address', u.home_address,
    'preferred_stoppage', u.preferred_stoppage,
    'notifications_enabled', COALESCE(u.notifications_enabled, TRUE),
    'created_at', u.created_at
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Student Preferred Area / Stoppage + Targeted Alert Preferences RPC
CREATE OR REPLACE FUNCTION rpc_update_student_preferences(
  p_token TEXT,
  p_preferred_stoppage TEXT DEFAULT NULL,
  p_notifications_enabled BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  v_actor users;
  v_updated users;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED: Valid session required.');
  END IF;

  UPDATE users SET
    preferred_stoppage = NULLIF(TRIM(COALESCE(p_preferred_stoppage, '')), ''),
    notifications_enabled = COALESCE(p_notifications_enabled, TRUE)
  WHERE id = v_actor.id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object('user', internal_safe_user_json(v_updated));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- 4. Update Controller Bus Management RPC to support trip_direction, departure_time & booking_window_mins
CREATE OR REPLACE FUNCTION rpc_manage_bus(p_token TEXT, p_action TEXT, p_id BIGINT DEFAULT NULL, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE v_actor users; v_rec buses;
BEGIN
  v_actor := internal_get_session_user(p_token);
  IF v_actor.id IS NULL THEN RETURN jsonb_build_object('error', 'UNAUTHORIZED'); END IF;

  IF v_actor.role = 'driver' THEN
    IF p_action <> 'update' THEN
      RETURN jsonb_build_object('error', 'UNAUTHORIZED: Drivers can only update live GPS telemetry.');
    END IF;
    UPDATE buses SET
      current_lat = COALESCE((p_payload->>'current_lat')::DOUBLE PRECISION, current_lat),
      current_lng = COALESCE((p_payload->>'current_lng')::DOUBLE PRECISION, current_lng),
      speed_kmh = COALESCE((p_payload->>'speed_kmh')::INTEGER, speed_kmh),
      status = CASE WHEN p_payload->>'status' IN ('active', 'standby') THEN p_payload->>'status' ELSE status END,
      updated_at = NOW()
    WHERE id = p_id RETURNING * INTO v_rec;
    RETURN jsonb_build_object('data', to_jsonb(v_rec));
  END IF;

  IF v_actor.role NOT IN ('controller', 'admin') THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED: Controller access required.');
  END IF;

  IF p_action = 'delete' THEN
    DELETE FROM buses WHERE id = p_id;
    RETURN jsonb_build_object('ok', TRUE);
  ELSIF p_action = 'update' THEN
    UPDATE buses SET
      route_id = CASE WHEN p_payload ? 'route_id' THEN NULLIF(p_payload->>'route_id', '')::BIGINT ELSE route_id END,
      driver_id = CASE WHEN p_payload ? 'driver_id' THEN NULLIF(p_payload->>'driver_id', '')::BIGINT ELSE driver_id END,
      status = COALESCE(p_payload->>'status', status),
      seat_config = COALESCE(p_payload->'seat_config', seat_config),
      trip_direction = CASE WHEN p_payload->>'trip_direction' IN ('to_campus', 'from_campus') THEN p_payload->>'trip_direction' ELSE trip_direction END,
      departure_time = CASE WHEN p_payload ? 'departure_time' AND p_payload->>'departure_time' ~ '^[0-2][0-9]:[0-5][0-9]$' THEN p_payload->>'departure_time' ELSE departure_time END,
      booking_window_mins = CASE WHEN p_payload ? 'booking_window_mins' THEN GREATEST(5, LEAST(60, (p_payload->>'booking_window_mins')::INTEGER)) ELSE booking_window_mins END,
      current_lat = COALESCE((p_payload->>'current_lat')::DOUBLE PRECISION, current_lat),
      current_lng = COALESCE((p_payload->>'current_lng')::DOUBLE PRECISION, current_lng),
      speed_kmh = COALESCE((p_payload->>'speed_kmh')::INTEGER, speed_kmh),
      updated_at = NOW()
    WHERE id = p_id RETURNING * INTO v_rec;
    RETURN jsonb_build_object('data', to_jsonb(v_rec));
  ELSE
    INSERT INTO buses (
      bus_number, plate_no, route_id, driver_id, status,
      trip_direction, departure_time, booking_window_mins,
      current_lat, current_lng, speed_kmh, seat_config, fitness_expiry
    )
    VALUES (
      p_payload->>'bus_number',
      COALESCE(p_payload->>'plate_no', 'Dhaka Metro Ba 11-XXXX'),
      NULLIF(p_payload->>'route_id', '')::BIGINT,
      NULLIF(p_payload->>'driver_id', '')::BIGINT,
      COALESCE(p_payload->>'status', 'standby'),
      CASE WHEN p_payload->>'trip_direction' IN ('to_campus', 'from_campus') THEN p_payload->>'trip_direction' ELSE 'from_campus' END,
      CASE WHEN p_payload->>'departure_time' ~ '^[0-2][0-9]:[0-5][0-9]$' THEN p_payload->>'departure_time' ELSE '14:20' END,
      COALESCE(GREATEST(5, LEAST(60, NULLIF(p_payload->>'booking_window_mins', '')::INTEGER)), 20),
      COALESCE((p_payload->>'current_lat')::DOUBLE PRECISION, 23.8769),
      COALESCE((p_payload->>'current_lng')::DOUBLE PRECISION, 90.3202),
      0,
      COALESCE(p_payload->'seat_config', '{"rows": 10, "leftCols": 2, "rightCols": 2, "backBench": false, "disabledSeats": [], "femaleSeats": [], "maleSeats": []}'::jsonb),
      COALESCE(NULLIF(p_payload->>'fitness_expiry', '')::DATE, DATE '2027-12-31')
    ) RETURNING * INTO v_rec;
    RETURN jsonb_build_object('data', to_jsonb(v_rec));
  END IF;
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('error', 'Bus number already exists.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- 5. Anti-Clock-Hack Server-Side 20-Min Window Enforcement (ONLY for `from_campus`)
CREATE OR REPLACE FUNCTION rpc_book_seat(
  p_token TEXT, p_bus_id BIGINT, p_route_id BIGINT,
  p_schedule_time TEXT, p_seat_number INTEGER, p_booking_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_student users;
  v_bus buses;
  v_qr TEXT;
  v_booking bookings;
  v_now_dhaka TIME;
  v_dep_time TIME;
  v_open_time TIME;
  v_now_mins INT;
  v_dep_mins INT;
  v_open_mins INT;
  v_win_mins INT;
BEGIN
  v_student := internal_get_session_user(p_token);
  IF v_student.id IS NULL OR v_student.role <> 'student' THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED: Please sign in with a valid student session.');
  END IF;

  SELECT * INTO v_bus FROM buses WHERE id = p_bus_id;
  IF v_bus.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Selected bus not found.');
  END IF;

  -- STRICT 20-MINUTE CAMPUS DEPARTURE WINDOW (Asia/Dhaka Server Time!)
  -- Enforced ONLY when bus is leaving university (`from_campus`)
  IF COALESCE(v_bus.trip_direction, 'from_campus') = 'from_campus'
     AND v_bus.departure_time IS NOT NULL
     AND v_bus.departure_time ~ '^[0-2][0-9]:[0-5][0-9]$' THEN

    v_win_mins := GREATEST(5, LEAST(60, COALESCE(v_bus.booking_window_mins, 20)));
    v_now_dhaka := (NOW() AT TIME ZONE 'Asia/Dhaka')::TIME;
    v_dep_time := v_bus.departure_time::TIME;

    v_now_mins := EXTRACT(HOUR FROM v_now_dhaka)::INT * 60 + EXTRACT(MINUTE FROM v_now_dhaka)::INT;
    v_dep_mins := EXTRACT(HOUR FROM v_dep_time)::INT * 60 + EXTRACT(MINUTE FROM v_dep_time)::INT;
    v_open_mins := GREATEST(0, v_dep_mins - v_win_mins);
    v_open_time := make_time(v_open_mins / 60, v_open_mins % 60, 0);

    IF v_now_mins < v_open_mins THEN
      INSERT INTO audit_logs (actor_name, actor_role, action, details)
      VALUES (v_student.name, 'student', 'EARLY_BOOKING_BLOCKED', 'Tried booking ' || v_bus.bus_number || ' before ' || to_char(v_open_time, 'HH12:MI AM'));
      RETURN jsonb_build_object(
        'error',
        'BOOKING_LOCKED: Seat booking for ' || v_bus.bus_number || ' (Leaves DIU at ' || to_char(v_dep_time, 'HH12:MI AM') || ') opens strictly at ' || to_char(v_open_time, 'HH12:MI AM') || ' (' || v_win_mins || ' mins before departure).'
      );
    END IF;

    IF v_now_mins > v_dep_mins THEN
      RETURN jsonb_build_object(
        'error',
        'DEPARTED: ' || v_bus.bus_number || ' already departed DIU Campus at ' || to_char(v_dep_time, 'HH12:MI AM') || '.'
      );
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings WHERE student_id = v_student.id AND bus_id = p_bus_id
      AND schedule_time = p_schedule_time AND booking_date = p_booking_date
  ) THEN
    RETURN jsonb_build_object('error', 'You already hold a seat on this trip. Cancel it first to change seats.');
  END IF;

  v_qr := 'DIU-' || COALESCE(v_bus.bus_number, 'BUS') || '-S' || p_seat_number || '-' || COALESCE(v_student.uni_id, v_student.id::TEXT) || '-' || UPPER(SUBSTR(encode(gen_random_bytes(3), 'hex'), 1, 6));

  INSERT INTO bookings (
    student_id, student_name, student_uni_id, student_gender, student_dept, student_batch,
    bus_id, route_id, schedule_time, seat_number, booking_date, qr_token
  ) VALUES (
    v_student.id, v_student.name, v_student.uni_id, v_student.gender, v_student.department, v_student.batch,
    p_bus_id, p_route_id, p_schedule_time, p_seat_number, p_booking_date, v_qr
  ) RETURNING * INTO v_booking;

  INSERT INTO audit_logs (actor_name, actor_role, action, details)
  VALUES (v_student.name, 'student', 'SEAT_BOOKED', 'Booked Seat #' || p_seat_number || ' on ' || COALESCE(v_bus.bus_number, 'Bus') || ' (' || p_schedule_time || ')');
  RETURN jsonb_build_object('data', to_jsonb(v_booking));
EXCEPTION
  WHEN unique_violation THEN RETURN jsonb_build_object('error', 'Seat #' || p_seat_number || ' was just booked by another student.');
  WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

NOTIFY pgrst, 'reload schema';
