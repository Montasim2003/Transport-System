# DIU Smart Transport v4.1 — Maximum Security Architecture (Web-Only Release)

## All 10 PostgreSQL Tables Protected with Strict Row Level Security (RLS)

| Security Layer | Threat Prevented | Implementation |
| :--- | :--- | :--- |
| **100% All-Table RLS** | Direct API data theft or database wiping via public Anon Key | `ENABLE ROW LEVEL SECURITY` active on ALL 10 tables; **0 anonymous write policies** exist anywhere. |
| **Server-Side Bcrypt (Cost 10)** | Password hash theft & rainbow tables | `pgcrypto` `crypt(password, gen_salt('bf', 10))` runs inside PostgreSQL; hashes never leave the DB. |
| **256-Bit Server Sessions** | Chrome DevTools `localStorage` role/gender spoofing | `user_sessions` validates opaque 256-bit token server-side on every request. |
| **Accounts 8-Digit Code Vault** | Code overlap, reuse, brute-force, or code theft | `rpc_issue_fee_code` (`gen_random_bytes` + `UNIQUE` + 1 active code per Student ID) + `FOR UPDATE` atomic burn + Student ID binding. |
| **Anti-QR-Theft Bookings** | Stealing another student's QR boarding pass or tracking peers | `rpc_get_bookings` strips `qr_token` & PII from all rows except the logged-in student's own seat. |
| **Anti-Spoof SOS Alerts** | Forging fake emergency alerts or leaking guardian phones | `rpc_create_sos` pulls verified identity & guardian contact from DB; `rpc_get_sos_alerts` restricted to Controller/Admin only. |
| **Immutable Audit Trail** | Attackers reading or erasing security logs | `audit_logs` has zero anon access; readable only by Admin via `rpc_get_audit_logs`. |
| **Kernel Triggers** | Privilege escalation & cross-gender seat bypass | `trg_prevent_role_escalation` & `trg_enforce_seat_gender` enforce rules inside PostgreSQL itself. |

| **Anti-Clock-Hack 20-Min Window** | Students advancing phone clock to book seats early | `rpc_book_seat` validates exact `Asia/Dhaka` server time inside PostgreSQL before allowing any `from_campus` booking and logs `EARLY_BOOKING_BLOCKED`. |
