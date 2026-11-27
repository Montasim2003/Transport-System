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
