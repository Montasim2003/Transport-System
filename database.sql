-- ==========================================
-- University Transport Management System SQL
-- ==========================================

-- ১. রুট টেবিল
CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  route_name TEXT NOT NULL,
  stoppages TEXT[] NOT NULL
);

-- ২. ইউজার টেবিল (Student, Driver, Controller, Admin ও ড্রাইভার-হেল্পারের তথ্যসহ)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uni_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'driver', 'controller', 'admin')),
  selected_route_id INT REFERENCES routes(id),
  selected_time TEXT,
  phone TEXT,
  license_no TEXT,
  address TEXT,
  helper_name TEXT,
  helper_phone TEXT
);

-- ৩. বাস টেবিল (লাইভ GPS লোকেশনসহ)
CREATE TABLE IF NOT EXISTS buses (
  id SERIAL PRIMARY KEY,
  bus_number TEXT UNIQUE NOT NULL,
  total_seats INT DEFAULT 40,
  driver_id INT REFERENCES users(id),
  route_id INT REFERENCES routes(id),
  current_lat DOUBLE PRECISION DEFAULT 23.8768,
  current_lng DOUBLE PRECISION DEFAULT 90.3201,
  is_active BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ৪. বাসের সময়সূচি (Schedules)
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  bus_id INT REFERENCES buses(id) ON DELETE CASCADE,
  route_id INT REFERENCES routes(id) ON DELETE CASCADE,
  departure_time TIME NOT NULL
);

-- ৫. সিট বুকিং টেবিল (ডাবল বুকিং প্রতিরোধসহ)
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES users(id) ON DELETE CASCADE,
  schedule_id INT REFERENCES schedules(id) ON DELETE CASCADE,
  seat_number INT NOT NULL,
  booking_date DATE NOT NULL,
  status TEXT DEFAULT 'confirmed',
  UNIQUE(schedule_id, seat_number, booking_date)
);

-- ৬. ৮-ডিজিট পেমেন্ট ভেরিফিকেশন কোড টেবিল
CREATE TABLE IF NOT EXISTS payment_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(8) UNIQUE NOT NULL,
  student_uni_id TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Initial Seed Data (Demo Users, Buses & Codes)
-- ==========================================

INSERT INTO routes (id, route_name, stoppages) VALUES
(1, 'Uttara Route', ARRAY['Campus', 'Ashulia', 'Dhour', 'House Building', 'Uttara Sector-7']),
(2, 'Mirpur Route', ARRAY['Campus', 'Birulia', 'Mirpur-1', 'Mirpur-10', 'Kazipara']),
(3, 'Dhanmondi Route', ARRAY['Campus', 'Gabtoli', 'Shyamoli', 'Asad Gate', 'Dhanmondi-27']),
(4, 'Savar Route', ARRAY['Campus', 'Khagan', 'Jahangirnagar Gate', 'Savar Bazar'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (uni_id, name, email, password, role, selected_route_id, selected_time, phone, license_no, address, helper_name, helper_phone) VALUES
('STU-101', 'Jubair', 'jubair@diu.edu.bd', '1234', 'student', 1, '08:30:00', NULL, NULL, NULL, NULL, NULL),
('STU-102', 'Montasim', 'montasim@diu.edu.bd', '1234', 'student', 2, '08:30:00', NULL, NULL, NULL, NULL, NULL),
('DRV-01', 'Abdul Karim', 'karim.driver@uni.edu.bd', '1234', 'driver', NULL, NULL, '01711-223344', 'DL-DHK-2021-884920', 'জিরাবো, আশুলিয়া, সাভার, ঢাকা', 'মোঃ সুমন মিয়া', '01812-556677'),
('DRV-02', 'Abdur Rahim', 'rahim.driver@uni.edu.bd', '1234', 'driver', NULL, NULL, '01715-667788', 'DL-DHK-2020-552190', 'মিরপুর-১০, সেনপাড়া পর্বতা, ঢাকা', 'মোঃ রাকিব হাসান', '01911-334455'),
('DRV-03', 'Rafiqul Islam', 'rafiq.driver@uni.edu.bd', '1234', 'driver', NULL, NULL, '01611-998877', 'DL-DHK-2022-331045', 'গাবতলী, মাজার রোড, ঢাকা', 'মোঃ জাহিদুল ইসলাম', '01515-443322'),
('CON-01', 'Transport Controller', 'controller@uni.edu.bd', '1234', 'controller', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ADM-01', 'Head Transport Admin', 'admin@uni.edu.bd', '1234', 'admin', NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (uni_id) DO NOTHING;

INSERT INTO payment_codes (code, student_uni_id, is_used) VALUES
('20261001', 'STU-104', false),
('20261002', 'STU-105', false),
('20261003', 'STU-106', false),
('20261004', 'STU-107', false),
('20261005', 'STU-108', false)
ON CONFLICT (code) DO NOTHING;