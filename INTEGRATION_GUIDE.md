# DIU Smart Transport v2.0 — University Integration & Demo Handoff Guide

This document maps every **Demo Data block** and every **University API / Database Integration Point** embedded in the codebase so the DIU Dean, Faculty Reviewers, and IT Department can transition this system directly into official university production.

## 1. Where Demo Data Lives (`[DEMO DATA]`)
- **`database.sql` (Bottom Section):** Contains sample students (`jubair@diu.edu.bd`, `montasim@diu.edu.bd`, `rafia@diu.edu.bd`), sample drivers, routes (`Dhanmondi`, `Uttara`, `Mirpur-10`, `Savar`), buses (`Bus-01` to `Bus-04`), and sample registration verification codes.
- **`lib/supabase.js` (`DEMO_SEED_DATA`):** Local offline fallback seed data used only when Supabase keys are absent or `FORCE_DEMO_OFFLINE_MODE = true`.
- **`app/page.js` (Bottom Collapsible Drawer):** The *"Dean / Faculty Presentation Quick-Fill (DEMO ONLY)"* card — remove this single `<div>` block before public launch.
- **`app/driver/page.js` (`Demo: Simulate Route GPS` button):** Simulates bus movement along route stoppages for indoor demonstrations; real device GPS (`Start Live Device GPS`) is already built right beside it.

## 2. Official DIU Integration Points (`[DIU INTEGRATION POINT]`)
| # | File | Integration Point | How DIU IT Connects It |
|---|------|-------------------|------------------------|
| 1 | `lib/supabase.js` | **University Database / ERP Adapter** | Update `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` to DIU's managed PostgreSQL/Supabase instance, or point `db` methods to DIU REST APIs. |
| 2 | `lib/auth.js` | **DIU Student Portal SSO / OAuth2** | Swap `loginUser()` with DIU SSO / Google Workspace (`@diu.edu.bd`) OAuth2 verification while retaining role-based session guards. |
| 3 | `lib/auth.js` & `database.sql` | **DIU Accounts / Transport Fee Verification API** | Connect DIU Student Payment Webhook to auto-insert paid 8-digit codes into `verification_codes` whenever a student clears their semester transport fee. |
| 4 | `components/LiveBusMap.js` & `buses` table | **Physical Bus GPS Tracker Telemetry** | Point DIU's physical bus GPS tracker webhooks to update `buses.current_lat`, `current_lng`, and `speed_kmh` every 5 seconds. |
| 5 | `database.sql` | **Production Row Level Security (RLS)** | Enable Supabase RLS policies tied to authenticated JWT role claims before opening to all DIU students. |
