import { db } from './supabase';

const SESSION_KEY = 'diu_transport_persistent_session_v2';

/**
 * SHA-256 Password Hashing
 * [DIU INTEGRATION POINT #2 — UNIVERSITY AUTH / SSO]
 * Replace loginUser() with DIU OAuth2 / Student Portal SSO token verification
 * when deploying on official diu.edu.bd servers.
 */
export async function hashPassword(password) {
  const text = String(password || '');
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `sha256_fallback_${text}`;
}

export function getSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id && parsed?.role ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(user) {
  if (typeof window === 'undefined' || !user) return;
  const safeUser = { ...user };
  delete safeUser.password_hash;
  delete safeUser.password;
  localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

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
 * Direct Database Login:
 * Authenticates against saved records in Supabase `users` table using:
 * Email OR Mobile Number OR Username OR Student ID OR Driving License No.
 */
export async function loginUser(identifier, password) {
  const cleanId = String(identifier || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();
  if (!cleanId || !cleanPass) {
    return { user: null, error: 'Please enter your Email / Phone / ID and Password.' };
  }

  const users = await db.getAll('users');
  const matched = users.find((u) => {
    const candidates = [u.email, u.phone, u.username, u.uni_id, u.license_no]
      .filter(Boolean)
      .map((v) => String(v).trim().toLowerCase());
    return candidates.includes(cleanId);
  });

  if (!matched) {
    return {
      user: null,
      error: 'No account found with this Email, Phone, or ID. Please register first.',
    };
  }

  const hashed = await hashPassword(cleanPass);
  const storedHash = matched.password_hash || matched.password || '';
  const validPass =
    storedHash === hashed ||
    storedHash === cleanPass ||
    storedHash === `sha256_fallback_${cleanPass}`;

  if (!validPass) {
    return { user: null, error: 'Incorrect password. Please try again.' };
  }

  saveSession(matched);
  await db.logAudit(matched, 'USER_LOGIN', `${matched.name} (${matched.role}) signed in.`);
  return { user: matched, error: null };
}

/**
 * Multi-Role Registration (Student, Driver, Controller, Admin):
 * Saves complete registration details directly to Supabase `users` table
 * and persists the session immediately until the user clicks Logout.
 */
export async function registerUser(form) {
  const role = form.role;
  const codeInput = String(form.verification_code || '').trim().toUpperCase();

  if (!codeInput) {
    return { user: null, error: 'Verification code from DIU Transport / Accounts Office is required.' };
  }

  const codes = await db.getAll('verification_codes');
  const codeRecord = codes.find(
    (c) => String(c.code).trim().toUpperCase() === codeInput && c.role === role
  );

  if (!codeRecord) {
    return {
      user: null,
      error: `Invalid ${role.toUpperCase()} verification code. Please check with DIU Transport Office.`,
    };
  }
  if (codeRecord.is_used) {
    return { user: null, error: 'This verification code has already been used by another account.' };
  }

  const existingUsers = await db.getAll('users');
  const cleanEmail = form.email ? String(form.email).trim().toLowerCase() : null;
  const cleanPhone = form.phone ? String(form.phone).trim() : null;

  if (cleanEmail && existingUsers.some((u) => (u.email || '').toLowerCase() === cleanEmail)) {
    return { user: null, error: 'This email address is already registered. Please sign in.' };
  }
  if (cleanPhone && existingUsers.some((u) => (u.phone || '') === cleanPhone)) {
    return { user: null, error: 'This mobile number is already registered. Please sign in.' };
  }

  if (role === 'student' && (!cleanEmail || !form.name || !form.phone || !form.password)) {
    return { user: null, error: 'Please complete Name, University Email, Phone, and Password.' };
  }
  if (role === 'driver' && (!form.name || !form.license_no || !form.phone || !form.helper_name || !form.helper_phone || !form.password)) {
    return { user: null, error: 'Drivers must enter Name, Driving License No, Mobile, Helper Name, Helper Phone, and Password.' };
  }
  if ((role === 'controller' || role === 'admin') && (!cleanEmail || !form.name || !form.password)) {
    return { user: null, error: 'Please complete Name, University Email, and Password.' };
  }

  const password_hash = await hashPassword(form.password);
  const autoUsername =
    (form.username || '').trim().toLowerCase() ||
    (cleanEmail ? cleanEmail.split('@')[0] : cleanPhone);

  const newUserPayload = {
    uni_id: form.uni_id?.trim() || codeRecord.assigned_uni_id || `${role.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    username: autoUsername,
    name: form.name.trim(),
    email: cleanEmail || `${cleanPhone}@driver.diu.edu.bd`,
    phone: cleanPhone,
    password_hash,
    role,
    department: form.department?.trim() || (role === 'controller' ? 'Transport Office' : role === 'admin' ? 'Administration' : null),
    batch: form.batch?.trim() || null,
    guardian_phone: form.guardian_phone?.trim() || null,
    license_no: form.license_no?.trim() || null,
    helper_name: form.helper_name?.trim() || null,
    helper_phone: form.helper_phone?.trim() || null,
    home_address: form.home_address?.trim() || null,
  };

  const { data: created, error } = await db.insert('users', newUserPayload);
  if (error || !created) {
    return { user: null, error: error || 'Registration failed. Please try again.' };
  }

  // Merge form fields into session object so UI always has full details
  const fullUserRecord = { ...newUserPayload, ...created };

  // Mark office code as consumed in Supabase
  await db.update('verification_codes', codeRecord.id, {
    is_used: true,
    used_by_email: fullUserRecord.email || fullUserRecord.phone,
  });

  // Save persistent session immediately — stays logged in until explicit Logout click
  saveSession(fullUserRecord);
  await db.logAudit(fullUserRecord, 'USER_REGISTER', `Registered new ${role}: ${fullUserRecord.name}`);
  return { user: fullUserRecord, error: null };
}
