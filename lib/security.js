/**
 * ============================================================================
 * DIU SMART TRANSPORT v4.0 — CLIENT DEFENSE-IN-DEPTH UTILITIES
 * ============================================================================
 * Note: Primary cryptography (Bcrypt password hashing, 256-bit session tokens,
 * brute-force rate limiting, RLS, and 8-digit code locking) runs SERVER-SIDE
 * inside PostgreSQL SECURITY DEFINER RPCs (`database.sql`).
 * This module provides client-side input sanitization, XSS prevention, and
 * cryptographic 8-digit generation for offline fallback.
 * ============================================================================
 */

export function sanitizeText(val, maxLen = 160) {
  return String(val ?? '')
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, maxLen);
}

export function generateCrypto8DigitCode(existingSet = new Set()) {
  for (let i = 0; i < 60; i++) {
    let randVal;
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      randVal = arr[0];
    } else {
      randVal = Math.floor(Math.random() * 0xffffffff);
    }
    const code = String(10000000 + (randVal % 90000000));
    if (!existingSet.has(code)) return code;
  }
  return String(10000000 + (Date.now() % 90000000));
}

export function evaluatePasswordStrength(pwd) {
  const p = String(pwd || '');
  if (p.length < 6) return { score: 1, label: 'Too Short (Min 6 chars)', valid: false };
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasNum = /[0-9]/.test(p);
  const hasSpecial = /[^A-Za-z0-9]/.test(p);
  if (p.length >= 8 && hasUpper && hasLower && hasNum && hasSpecial) {
    return { score: 4, label: 'Strong (Bank-Grade)', valid: true };
  }
  if (p.length >= 6 && (hasUpper || hasLower) && hasNum) {
    return { score: 3, label: 'Good (Letters + Numbers)', valid: true };
  }
  return { score: 2, label: 'Fair (Add numbers/symbols)', valid: true };
}
