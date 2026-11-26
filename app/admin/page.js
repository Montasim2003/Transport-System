'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, FileSpreadsheet, Download, KeyRound,
  LogOut, MapPin, ShieldAlert, ClipboardList, Search, Copy, Check,
  RefreshCw, Plus, Trash2, Sparkles, Lock, Receipt
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LiveBusMap from '@/components/LiveBusMap';
import { db } from '@/lib/supabase';
import { getVerifiedSession, clearSession, getDashboardPath } from '@/lib/auth';

function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('codes'); // codes | map | students_csv | audits

  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [codes, setCodes] = useState([]);
  const [audits, setAudits] = useState([]);

  const [trackBusId, setTrackBusId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [showRawCsv, setShowRawCsv] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [toast, setToast] = useState('');

  // Dedicated Accounts Office: Student 8-Digit Fee Code Generator
  const [studentFeeForm, setStudentFeeForm] = useState({
    student_id: '',
    student_name: '',
    payment_ref: '',
  });
  const [latestIssuedCode, setLatestIssuedCode] = useState(null);
  const [issuingStudent, setIssuingStudent] = useState(false);

  // Staff Code Generator (Driver / Controller / Admin)
  const [staffCodeForm, setStaffCodeForm] = useState({
    role: 'driver',
    assigned_name: '',
    assigned_uni_id: '',
  });

  const today = new Date().toISOString().slice(0, 10);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

  const loadData = useCallback(async () => {
    const [bList, rList, uList, bkList, sosList, cList, aList] = await Promise.all([
      db.getAll('buses', 'id', true),
      db.getAll('routes', 'id', true),
      db.getDirectory(),
      db.getAll('bookings', 'id', true),
      db.getAll('sos_alerts', 'id', false),
      db.getVerificationCodes(),
      db.getAll('audit_logs', 'id', false),
    ]);
    setBuses(bList);
    setRoutes(rList);
    setUsers(uList);
    setBookings(bkList.filter((b) => !b.booking_date || b.booking_date === today));
    setSosAlerts(sosList);
    setCodes(cList);
    setAudits(aList);
  }, [today]);

  useEffect(() => {
    let active = true;
    let poll;
    (async () => {
      const session = await getVerifiedSession();
      if (!active) return;
      if (!session) { router.replace('/'); return; }
      if (session.role !== 'admin') { router.replace(getDashboardPath(session.role)); return; }
      setUser(session);
      loadData();
      poll = setInterval(loadData, 5000);
    })();
    return () => { active = false; if (poll) clearInterval(poll); };
  }, [router, loadData]);

  const students = useMemo(() => users.filter((u) => u.role === 'student'), [users]);
  const departments = useMemo(() => {
    const set = new Set(students.map((s) => s.department).filter(Boolean));
    return ['ALL', ...set];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (deptFilter !== 'ALL' && s.department !== deptFilter) return false;
      if (!q) return true;
      return [s.name, s.email, s.uni_id, s.phone, s.department, s.batch, s.gender]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [students, searchQuery, deptFilter]);

  const csvContent = useMemo(() => {
    const headers = [
      'Student_ID',
      'Full_Name',
      'Gender',
      'DIU_Email',
      'Mobile_Number',
      'Department',
      'Batch',
      'Guardian_Emergency_Phone',
      'Address',
      'Registered_At',
    ];
    const rows = filteredStudents.map((s) => [
      s.uni_id || '',
      s.name || '',
      (s.gender || '').toUpperCase(),
      s.email || '',
      s.phone || '',
      s.department || '',
      s.batch || '',
      s.guardian_phone || '',
      s.home_address || '',
      s.created_at ? new Date(s.created_at).toLocaleString('en-BD') : '',
    ]);
    return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  }, [filteredStudents]);

  const handleDownloadCsv = () => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DIU_Registered_Students_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    db.logAudit(user, 'CSV_EXPORTED', `Exported ${filteredStudents.length} registered student records to CSV.`);
    showToast(`📥 Downloaded DIU_Registered_Students_${today}.csv (${filteredStudents.length} records)`);
  };

  // Dedicated Accounts Office 8-Digit Student Fee Code Generator (Zero Overlap, Single-Use, Student-ID Bound)
  const handleGenerateStudent8DigitCode = async (e) => {
    e.preventDefault();
    const cleanId = studentFeeForm.student_id.trim();
    if (!cleanId) {
      showToast('⚠️ Please enter the Student ID first.');
      return;
    }
    setIssuingStudent(true);
    const { data, error } = await db.issueFeeCode({
      role: 'student',
      assigned_uni_id: cleanId,
      assigned_name: studentFeeForm.student_name.trim(),
      payment_ref: studentFeeForm.payment_ref.trim(),
    });
    setIssuingStudent(false);

    if (error || !data) {
      showToast(`⚠️ ${error || 'Could not generate 8-digit code.'}`);
      return;
    }

    setLatestIssuedCode(data);
    setStudentFeeForm({ student_id: '', student_name: '', payment_ref: '' });
    showToast(`✅ Unique 8-Digit Transport Code ${data.code} issued for Student ID ${cleanId}!`);
    loadData();
  };

  const handleGenerateStaffCode = async (e) => {
    e.preventDefault();
    const { data, error } = await db.issueFeeCode({
      role: staffCodeForm.role,
      assigned_uni_id: staffCodeForm.assigned_uni_id.trim(),
      assigned_name: staffCodeForm.assigned_name.trim(),
    });
    if (error || !data) {
      showToast(`⚠️ ${error || 'Failed to issue staff code.'}`);
      return;
    }
    setStaffCodeForm({ role: 'driver', assigned_name: '', assigned_uni_id: '' });
    showToast(`🔑 Generated ${data.role.toUpperCase()} Code: ${data.code}`);
    loadData();
  };

  const handleCopyCode = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const activeSOS = sosAlerts.filter((a) => a.status === 'active');

  if (!user) return null;

  return (
    <div className="min-h-screen pb-14 px-3 sm:px-6 pt-4">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <header className="glass-panel px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">
                DIU Executive Admin & Accounts Portal
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user.name} • {user.email} • Zero-Trust RLS Active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={loadData} className="glass-btn p-2 rounded-xl cursor-pointer" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <ThemeToggle />
            <button
              onClick={() => { clearSession(); router.replace('/'); }}
              className="glass-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </header>

        {/* Active SOS Monitor */}
        {activeSOS.length > 0 && (
          <div className="rounded-2xl bg-rose-600 text-white p-4 shadow-lg space-y-2">
            {activeSOS.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 animate-bounce" />
                  <span>
                    <b>🚨 ACTIVE SOS ({s.category})</b> on <b>{s.bus_number}</b> — {s.reporter_name} ({s.reporter_phone}) • Guardian: {s.guardian_phone}
                  </span>
                </div>
                <button
                  onClick={async () => { await db.update('sos_alerts', s.id, { status: 'resolved' }); loadData(); }}
                  className="px-3 py-1 rounded-lg bg-white text-rose-700 font-bold cursor-pointer"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        )}

        {toast && (
          <div className="glass-panel px-4 py-3 text-xs sm:text-sm font-bold border-l-4 border-l-emerald-500">
            {toast}
          </div>
        )}

        {/* Executive KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Fleet Buses', value: buses.length, sub: `${buses.filter((b) => b.status === 'active').length} Live Moving` },
            { label: 'Registered Students', value: students.length, sub: 'Verified via 8-Digit Code' },
            { label: 'Unused Fee Codes', value: codes.filter((c) => c.role === 'student' && !c.is_used).length, sub: 'Zero-Overlap Vault' },
            { label: 'Active SOS Alerts', value: activeSOS.length, sub: activeSOS.length ? 'Immediate Action' : 'All Clear' },
          ].map((kpi, i) => (
            <div key={i} className="glass-card p-4">
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">{kpi.label}</div>
              <div className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">{kpi.value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap gap-2">
          {[
            { id: 'codes', label: 'Accounts 8-Digit Code Generator', icon: KeyRound },
            { id: 'map', label: 'All-Bus Live Map', icon: MapPin },
            { id: 'students_csv', label: `Registered Students CSV (${students.length})`, icon: FileSpreadsheet },
            { id: 'audits', label: 'Security Audit Logs', icon: ClipboardList },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer ${
                  activeTab === t.id ? 'glass-btn-primary' : 'glass-card text-slate-700 dark:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        {/* ==================== TAB 1: ACCOUNTS 8-DIGIT STUDENT CODE GENERATOR ==================== */}
        {activeTab === 'codes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Primary Student Transport Fee 8-Digit Code Generator */}
            <div className="lg:col-span-5 space-y-5">
              <div className="glass-panel p-5 sm:p-6 space-y-4 border-2 border-slate-400/30 dark:border-slate-500/30">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white">
                      Student Transport Fee — 8-Digit Code Generator
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Enter the Student ID after fee payment. System generates a strictly unique, single-use 8-digit code bound to that Student ID (zero overlap guaranteed by PostgreSQL).
                    </p>
                  </div>
                </div>

                <form onSubmit={handleGenerateStudent8DigitCode} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      Student ID (Required) *
                    </label>
                    <input
                      type="text"
                      required
                      value={studentFeeForm.student_id}
                      onChange={(e) => setStudentFeeForm({ ...studentFeeForm, student_id: e.target.value })}
                      placeholder="e.g. 241-35-489"
                      className="glass-input w-full px-3.5 py-2.5 text-sm font-mono font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Student Name (Optional)</label>
                      <input
                        type="text"
                        value={studentFeeForm.student_name}
                        onChange={(e) => setStudentFeeForm({ ...studentFeeForm, student_name: e.target.value })}
                        placeholder="e.g. Jubair Ahmed"
                        className="glass-input w-full px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Accounts Receipt No (Optional)</label>
                      <input
                        type="text"
                        value={studentFeeForm.payment_ref}
                        onChange={(e) => setStudentFeeForm({ ...studentFeeForm, payment_ref: e.target.value })}
                        placeholder="e.g. RCPT-2026-901"
                        className="glass-input w-full px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={issuingStudent}
                    className="glass-btn-primary w-full py-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Sparkles className="w-4 h-4" />
                    {issuingStudent ? 'Generating Cryptographic 8-Digit Code...' : 'Generate Unique 8-Digit Transport Code'}
                  </button>
                </form>

                {/* GENERATED 8-DIGIT CODE DISPLAY CARD (DIRECTLY BELOW INPUT!) */}
                {latestIssuedCode && (
                  <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border-2 border-emerald-500/50 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" /> Bound to ID: {latestIssuedCode.assigned_uni_id}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px]">
                        1-Time Use Only
                      </span>
                    </div>

                    <div className="bg-white/90 dark:bg-slate-900/90 rounded-xl p-3.5 flex items-center justify-between border border-emerald-500/30">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">8-Digit Registration Code</div>
                        <div className="text-2xl sm:text-3xl font-mono font-black tracking-[0.22em] text-slate-900 dark:text-white mt-0.5">
                          {latestIssuedCode.code}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(latestIssuedCode.code)}
                        className="glass-btn-primary px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedCode === latestIssuedCode.code ? (
                          <><Check className="w-4 h-4" /> Copied</>
                        ) : (
                          <><Copy className="w-4 h-4" /> Copy</>
                        )}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      Hand this 8-digit code to the student. When they register in the DIU Transport App with Student ID <b>{latestIssuedCode.assigned_uni_id}</b>, this code burns permanently after 1 use.
                    </div>
                  </div>
                )}
              </div>

              {/* Staff Code Issuer (Driver / Controller / Admin) */}
              <form onSubmit={handleGenerateStaffCode} className="glass-card p-5 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Issue Staff Registration Code (Driver / Controller / Admin)
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <select
                    value={staffCodeForm.role}
                    onChange={(e) => setStaffCodeForm({ ...staffCodeForm, role: e.target.value })}
                    className="glass-input px-3 py-2 text-xs font-bold"
                  >
                    <option value="driver">Driver Code</option>
                    <option value="controller">Controller Code</option>
                    <option value="admin">Admin Code</option>
                  </select>
                  <input
                    type="text"
                    value={staffCodeForm.assigned_name}
                    onChange={(e) => setStaffCodeForm({ ...staffCodeForm, assigned_name: e.target.value })}
                    placeholder="Staff Name (Optional)"
                    className="glass-input px-3 py-2 text-xs"
                  />
                </div>
                <button type="submit" className="glass-btn w-full py-2.5 rounded-xl text-xs font-extrabold cursor-pointer">
                  Generate Unique Staff Code
                </button>
              </form>
            </div>

            {/* Right Column: Complete Issued Code Vault */}
            <div className="lg:col-span-7 glass-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
                    Issued Verification Codes Vault ({codes.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Protected by PostgreSQL RLS — only Admin & Controller can view this registry.
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {codes.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-white/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono font-black text-base tracking-wider text-slate-900 dark:text-white">
                          {c.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700">
                          {c.role}
                        </span>
                        {c.assigned_uni_id && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300">
                            ID: {c.assigned_uni_id}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {c.assigned_name ? `${c.assigned_name} • ` : ''}
                        {c.payment_ref ? `Receipt: ${c.payment_ref} • ` : ''}
                        {c.used_by_email ? `Redeemed by ${c.used_by_email}` : `Issued by ${c.created_by || 'Office'}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase ${
                        c.is_used
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {c.is_used ? 'Used (Burned)' : 'Active (1-Use)'}
                      </span>
                      {!c.is_used && (
                        <>
                          <button onClick={() => handleCopyCode(c.code)} className="glass-btn p-1.5 rounded-lg cursor-pointer" title="Copy Code">
                            {copiedCode === c.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={async () => { await db.revokeCode(c.id); showToast(`Revoked unused code ${c.code}`); loadData(); }}
                            className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 cursor-pointer"
                            title="Revoke Unused Code"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: LIVE FLEET MAP ==================== */}
        {activeTab === 'map' && (
          <div className="glass-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">
                  University-Wide Live Bus Telemetry Map
                </h2>
                <p className="text-[11px] text-slate-500">Monitor all university buses simultaneously or click any bus to inspect individually.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setTrackBusId(null)} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${trackBusId === null ? 'glass-btn-primary' : 'glass-btn'}`}>
                  All Buses ({buses.length})
                </button>
                {buses.map((b) => (
                  <button key={b.id} onClick={() => setTrackBusId(b.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${Number(trackBusId) === Number(b.id) ? 'glass-btn-primary' : 'glass-btn'}`}>
                    {b.bus_number}
                  </button>
                ))}
              </div>
            </div>
            <LiveBusMap buses={buses} routes={routes} selectedBusId={trackBusId} height="420px" onSelectBus={(b) => setTrackBusId(b.id)} />
          </div>
        )}

        {/* ==================== TAB 3: REGISTERED STUDENTS CSV ==================== */}
        {activeTab === 'students_csv' && (
          <div className="glass-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" /> Registered Students CSV Directory
                </h2>
                <p className="text-[11px] text-slate-500">
                  Live registry of all verified DIU students. Inspect spreadsheet view, raw CSV format, or export to Excel/CSV.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setShowRawCsv(!showRawCsv)} className="glass-btn px-3 py-2 rounded-xl text-xs font-bold cursor-pointer">
                  {showRawCsv ? 'Spreadsheet Table View' : 'View Raw CSV Text'}
                </button>
                <button onClick={handleDownloadCsv} className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer">
                  <Download className="w-4 h-4" /> Download .CSV File
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Name, Student ID, Gender, DIU Email, Phone..."
                  className="glass-input w-full pl-9 pr-3 py-2 text-xs"
                />
              </div>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="glass-input px-3 py-2 text-xs font-bold">
                {departments.map((d) => <option key={d} value={d}>Dept: {d}</option>)}
              </select>
            </div>

            {showRawCsv ? (
              <pre className="p-4 rounded-2xl bg-slate-900 text-emerald-300 text-[11px] font-mono overflow-x-auto leading-relaxed">
                {csvContent}
              </pre>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/60 dark:border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3.5 py-3">Student ID</th>
                      <th className="px-3.5 py-3">Full Name</th>
                      <th className="px-3.5 py-3">Gender</th>
                      <th className="px-3.5 py-3">DIU Email</th>
                      <th className="px-3.5 py-3">Mobile</th>
                      <th className="px-3.5 py-3">Dept / Batch</th>
                      <th className="px-3.5 py-3">Guardian SOS Phone</th>
                      <th className="px-3.5 py-3">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60 bg-white/40 dark:bg-slate-900/30">
                    {filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-white/60 dark:hover:bg-slate-800/50">
                        <td className="px-3.5 py-2.5 font-mono font-bold">{s.uni_id || '—'}</td>
                        <td className="px-3.5 py-2.5 font-bold text-slate-800 dark:text-white">{s.name}</td>
                        <td className="px-3.5 py-2.5 uppercase font-bold">{s.gender || '—'}</td>
                        <td className="px-3.5 py-2.5">{s.email}</td>
                        <td className="px-3.5 py-2.5">{s.phone || '—'}</td>
                        <td className="px-3.5 py-2.5">{s.department || '—'} {s.batch ? `/ B-${s.batch}` : ''}</td>
                        <td className="px-3.5 py-2.5 font-semibold text-rose-600 dark:text-rose-400">{s.guardian_phone || '—'}</td>
                        <td className="px-3.5 py-2.5 text-slate-500">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: SECURITY AUDIT LOGS ==================== */}
        {activeTab === 'audits' && (
          <div className="glass-card p-4 sm:p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">
              Zero-Trust Security & Operations Audit Trail
            </h2>
            <div className="space-y-2 max-h-[450px] overflow-y-auto">
              {audits.map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-white/55 dark:bg-slate-800/55 border border-white/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 mr-2">{a.action}</span>
                    <span className="font-bold text-slate-800 dark:text-white">{a.actor_name}</span>
                    <span className="text-slate-500 ml-1">({a.actor_role})</span>
                    <div className="text-slate-600 dark:text-slate-300 mt-1">{a.details}</div>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {a.created_at ? new Date(a.created_at).toLocaleString('en-BD') : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
