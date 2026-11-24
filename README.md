# University Transport Management System

A full-stack, mobile-responsive University Transport Management System built with **Next.js**, **Tailwind CSS**, and **Leaflet**, featuring a built-in **Offline-First Database Engine** (with optional **Supabase** cloud sync).

## Key Features
- **Glassmorphism Authentication & Anti-Fraud Registration:** Student registration requires a valid 8-digit university payment verification code (single-use lock).
- **Student Dashboard:** Route & schedule selection, 25-minute pre-departure 40-seat booking grid, and live bus tracking map.
- **Driver Panel:** Live GPS location sharing and simulation mode.
- **Transport Controller Room:** Click any bus number to inspect full driver & helper profiles (phone, driving license, home address, emergency call) alongside live bus location and extra bus scheduling.
- **Head Admin Panel:** Fleet overview, route/bus management, and role-based user creation.

## How to Run on Any PC (No Internet / No Supabase Setup Needed)
1. Download or clone this repository.
2. Open a terminal in the project folder and install dependencies:
   ```bash
   npm install
   run in terminal : npm run dev

   Open http://localhost:3000 in your browser.
(Note: Set OFFLINE_MODE = false in lib/supabase.js and import database.sql into Supabase if you want to switch to live cloud database mode.)
   
   Demo Credentials (Password: 1234)
Student 1: jubair@diu.edu.bd (STU-101)

Student 2: montasim@diu.edu.bd (STU-102)

Driver: karim.driver@uni.edu.bd (DRV-01)

Controller: controller@uni.edu.bd (CON-01)

Admin: admin@uni.edu.bd (ADM-01)

Test 8-Digit Registration Code: ID STU-104 | Code 20261001