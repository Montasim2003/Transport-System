'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bus, ShieldCheck, GraduationCap, Navigation, Radio, Lock,
  Mail, KeyRound, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { getSession, getDashboardPath, loginUser, registerUser } from '@/lib/auth';
import { getDatabaseMode } from '@/lib/supabase';

const ROLES = [
  { id: 'student', label: 'Student', icon: GraduationCap },
  { id: 'driver', label: 'Driver', icon: Navigation },
  { id: 'controller', label: 'Controller', icon: Radio },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
];

export default function AuthPortalPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [regRole, setRegRole] = useState('student');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Multi-Role Registration State
  const [form, setForm] = useState({
    verification_code: '',
    name: '',
    uni_id: '',
    email: '',
    phone: '',
    password: '',
    department: 'SWE',
    batch: '',
    guardian_phone: '',
    license_no: '',
    helper_name: '',
    helper_phone: '',
    home_address: '',
  });

  // Persistent Auto-Login: Redirect directly to user's dashboard unless they clicked Logout
  useEffect(() => {
    const existing = getSession();
    if (existing?.role) {
      router.replace(getDashboardPath(existing.role));
      return;
    }
    setCheckingSession(false);
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { user, error: err } = await loginUser(identifier, password);
    setLoading(false);
    if (err || !user) {
      setError(err || 'Login failed');
      return;
    }
    router.replace(getDashboardPath(user.role));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { user, error: err } = await registerUser({ ...form, role: regRole });
    setLoading(false);
    if (err || !user) {
      setError(err || 'Registration failed');
      return;
    }
    router.replace(getDashboardPath(user.role));
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card px-8 py-6 flex items-center gap-3 text-slate-700 dark:text-slate-200 font-semibold">
          <Bus className="w-6 h-6 animate-bounce" />
          <span>Loading your DIU Transport workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 py-6 sm:py-10">
      {/* Top Minimal Liquid Glass Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl glass-panel flex items-center justify-center text-slate-800 dark:text-white shadow-sm">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-800 dark:text-white">
              DIU Smart Transport
            </h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Daffodil International University • Fleet & Safety OS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 glass-card px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {getDatabaseMode() === 'SUPABASE_CLOUD' ? 'Cloud Database Connected' : 'Local Storage Mode'}
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* Center Liquid Glass Auth Container */}
      <main className="max-w-xl w-full mx-auto my-auto">
        <div className="glass-panel p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 dark:via-white/30 to-transparent" />

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-slate-200/60 dark:bg-slate-800/70 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              New Registration (4 Roles)
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/12 border border-rose-500/35 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">
                  Sign In to Your Account
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enter your registered DIU Email, Mobile Number, Student ID, or Driving License. Your session remains active until you log out.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Email / Mobile / Student ID / License No
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. jubair@diu.edu.bd or 017XXXXXXXX"
                    className="glass-input w-full pl-10 pr-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="glass-input w-full pl-10 pr-11 py-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="glass-btn-primary w-full py-3.5 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Signing In...' : 'Sign In & Stay Logged In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
                  Create Verified Account
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select your role and enter the verification code issued by DIU Transport / Accounts Office.
                </p>
              </div>

              {/* 4-Role Selector Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const active = regRole === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setRegRole(r.id); setError(''); }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col items-center text-center gap-1 ${
                        active
                          ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-800 dark:border-white shadow-md'
                          : 'glass-card text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-bold">{r.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Verification Code (Required for all 4 roles) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {regRole === 'student'
                    ? 'Transport Fee Verification Code (8-Digit) *'
                    : regRole === 'driver'
                    ? 'Transport Office Driver Code *'
                    : regRole === 'controller'
                    ? 'Transport Office Controller Code *'
                    : 'Admin Authorization Code *'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={form.verification_code}
                    onChange={(e) => setForm({ ...form, verification_code: e.target.value })}
                    placeholder="Enter your office verification code"
                    className="glass-input w-full pl-10 pr-4 py-2.5 text-sm font-mono uppercase"
                  />
                </div>
              </div>

              {/* Common Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter your full name"
                    className="glass-input w-full px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="017XXXXXXXX"
                    className="glass-input w-full px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              {/* Student Specific Fields */}
              {regRole === 'student' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">DIU Email *</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="jubair@diu.edu.bd"
                        className="glass-input w-full px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Student ID *</label>
                      <input
                        type="text"
                        required
                        value={form.uni_id}
                        onChange={(e) => setForm({ ...form, uni_id: e.target.value })}
                        placeholder="e.g. 241-35-489"
                        className="glass-input w-full px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Department</label>
                      <input
                        type="text"
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                        placeholder="SWE / CSE"
                        className="glass-input w-full px-3 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Batch</label>
                      <input
                        type="text"
                        value={form.batch}
                        onChange={(e) => setForm({ ...form, batch: e.target.value })}
                        placeholder="e.g. 42"
                        className="glass-input w-full px-3 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Guardian SOS Phone *</label>
                      <input
                        type="tel"
                        required
                        value={form.guardian_phone}
                        onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                        placeholder="017XXXXXXXX"
                        className="glass-input w-full px-3 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Driver Specific Fields */}
              {regRole === 'driver' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Driving License No *</label>
                      <input
                        type="text"
                        required
                        value={form.license_no}
                        onChange={(e) => setForm({ ...form, license_no: e.target.value })}
                        placeholder="DL-DHK-2026-XXXX"
                        className="glass-input w-full px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Home Address</label>
                      <input
                        type="text"
                        value={form.home_address}
                        onChange={(e) => setForm({ ...form, home_address: e.target.value })}
                        placeholder="Savar / Ashulia"
                        className="glass-input w-full px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Helper Name *</label>
                      <input
                        type="text"
                        required
                        value={form.helper_name}
                        onChange={(e) => setForm({ ...form, helper_name: e.target.value })}
                        placeholder="Bus Helper Name"
                        className="glass-input w-full px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Helper Mobile *</label>
                      <input
                        type="tel"
                        required
                        value={form.helper_phone}
                        onChange={(e) => setForm({ ...form, helper_phone: e.target.value })}
                        placeholder="018XXXXXXXX"
                        className="glass-input w-full px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Controller & Admin Fields */}
              {(regRole === 'controller' || regRole === 'admin') && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">University Official Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@diu.edu.bd"
                    className="glass-input w-full px-3.5 py-2.5 text-sm"
                  />
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Create Password *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Create a strong password (min 4 chars)"
                  className="glass-input w-full px-3.5 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="glass-btn-primary w-full py-3.5 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Saving to Database...' : `Complete ${regRole.toUpperCase()} Registration`}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-6">
        Daffodil International University • Smart Campus Transport System
      </footer>
    </div>
  );
}
