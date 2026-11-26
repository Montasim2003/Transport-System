'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Radio, Bus, MapPin, Route, Armchair, Users, AlertTriangle, LogOut,
  Plus, Trash2, Edit3, Save, PhoneCall, Megaphone, CheckCircle2,
  ShieldAlert, KeyRound, RefreshCw, Eye
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LiveBusMap from '@/components/LiveBusMap';
import BusSeatLayout, { computeBusCapacity, DEFAULT_SEAT_CONFIG } from '@/components/BusSeatLayout';
import { db } from '@/lib/supabase';
import { getVerifiedSession, clearSession, getDashboardPath } from '@/lib/auth';

export default function ControllerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('live'); // live | fleet | routes | seats | drivers

  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [codes, setCodes] = useState([]);

  const [trackBusId, setTrackBusId] = useState(null); // null = All Buses on One Map
  const [toast, setToast] = useState('');

  // Notice Form
  const [noticeForm, setNoticeForm] = useState({ title: '', message: '', priority: 'normal' });

  // Add Bus Form
  const [newBus, setNewBus] = useState({ bus_number: '', plate_no: '', route_id: '', driver_id: '', fitness_expiry: '2027-12-31' });

  // Route & Stoppage Editor State
  const [newRoute, setNewRoute] = useState({ name: '', start_point: '', end_point: 'DIU Smart City', schedules: '07:15 AM, 01:30 PM, 04:30 PM' });
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [routeEditDraft, setRouteEditDraft] = useState({ name: '', start_point: '', end_point: '', schedules: '', stoppages: [] });
  const [newStop, setNewStop] = useState({ name: '', offset_min: '15', lat: '23.8500', lng: '90.3350' });

  // Seat Layout Editor State (with White/General, Female, Male & Disable Seat Tools)
  const [seatEditBusId, setSeatEditBusId] = useState(null);
  const [seatDraft, setSeatDraft] = useState(DEFAULT_SEAT_CONFIG);
  const [seatBrush, setSeatBrush] = useState('female'); // 'general' | 'female' | 'male' | 'disable'

  // Driver Add/Edit State
  const [driverEditId, setDriverEditId] = useState(null);
  const [driverForm, setDriverForm] = useState({
    name: '', phone: '', email: '', license_no: '', helper_name: '', helper_phone: '', home_address: '', password: '1234',
  });

  // Quick Code Issuer State
  const [codeRole, setCodeRole] = useState('student');
  const [codeAssignedName, setCodeAssignedName] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const loadData = useCallback(async () => {
    const [bList, rList, uList, bkList, sosList, cList] = await Promise.all([
      db.getAll('buses', 'id', true),
      db.getAll('routes', 'id', true),
      db.getAll('users', 'id', true),
      db.getAll('bookings', 'id', true),
      db.getAll('sos_alerts', 'id', false),
      db.getAll('verification_codes', 'id', false),
    ]);
    setBuses(bList);
    setRoutes(rList);
    setDrivers(uList.filter((u) => u.role === 'driver'));
    setBookings(bkList.filter((b) => !b.booking_date || b.booking_date === today));
    setSosAlerts(sosList);
    setCodes(cList);

    // Suggest next sequential bus number (Bus-01, Bus-02, Bus-05...)
    setNewBus((prev) => {
      if (prev.bus_number) return prev;
      const maxNum = bList.reduce((mx, b) => {
        const m = String(b.bus_number || '').match(/\d+/);
        return Math.max(mx, m ? Number(m[0]) : 0);
      }, 0);
      const nextStr = `Bus-${String(maxNum + 1).padStart(2, '0')}`;
      return { ...prev, bus_number: nextStr, route_id: prev.route_id || (rList[0]?.id ? String(rList[0].id) : '') };
    });

    setSeatEditBusId((prev) => {
      if (prev && bList.some((x) => Number(x.id) === Number(prev))) return prev;
      const first = bList[0];
      if (first) setSeatDraft({ ...DEFAULT_SEAT_CONFIG, ...(first.seat_config || {}) });
      return first?.id || null;
    });
  }, [today]);

  useEffect(() => {
    let active = true;
    let poll;
    (async () => {
      const session = await getVerifiedSession();
      if (!active) return;
      if (!session) { router.replace('/'); return; }
      if (session.role !== 'controller') { router.replace(getDashboardPath(session.role)); return; }
      setUser(session);
      loadData();
      poll = setInterval(loadData, 5000);
    })();
    return () => { active = false; if (poll) clearInterval(poll); };
  }, [router, loadData]);

  // Select bus in Seat Layout Editor
  const handlePickSeatBus = (busId) => {
    setSeatEditBusId(busId);
    const bus = buses.find((b) => Number(b.id) === Number(busId));
    setSeatDraft({ ...DEFAULT_SEAT_CONFIG, ...(bus?.seat_config || {}) });
  };

  // Apply selected Seat Brush (General/White, Female, Male, or Disable) to clicked seat
  const handleApplySeatBrush = (seatNum) => {
    setSeatDraft((prev) => {
      const disabled = new Set((prev.disabledSeats || []).map(Number));
      const female = new Set((prev.femaleSeats || []).map(Number));
      const male = new Set((prev.maleSeats || []).map(Number));

      if (seatBrush === 'disable') {
        if (disabled.has(seatNum)) disabled.delete(seatNum);
        else {
          disabled.add(seatNum);
          female.delete(seatNum);
          male.delete(seatNum);
        }
      } else if (seatBrush === 'female') {
        disabled.delete(seatNum);
        male.delete(seatNum);
        if (female.has(seatNum)) female.delete(seatNum);
        else female.add(seatNum);
      } else if (seatBrush === 'male') {
        disabled.delete(seatNum);
        female.delete(seatNum);
        if (male.has(seatNum)) male.delete(seatNum);
        else male.add(seatNum);
      } else {
        // 'general' -> reset seat to default White (unrestricted)
        disabled.delete(seatNum);
        female.delete(seatNum);
        male.delete(seatNum);
      }

      return {
        ...prev,
        disabledSeats: [...disabled].sort((a, b) => a - b),
        femaleSeats: [...female].sort((a, b) => a - b),
        maleSeats: [...male].sort((a, b) => a - b),
      };
    });
  };

  const applyFrontRowsFemalePreset = (numRows = 3) => {
    const { gridRows } = computeBusCapacity(seatDraft);
    const frontNums = gridRows.slice(0, numRows).flatMap((r) => [...r.left, ...r.right]);
    const disabled = new Set((seatDraft.disabledSeats || []).map(Number));
    const male = new Set((seatDraft.maleSeats || []).map(Number));
    frontNums.forEach((n) => male.delete(n));
    setSeatDraft((prev) => ({
      ...prev,
      femaleSeats: frontNums.filter((n) => !disabled.has(n)),
      maleSeats: [...male],
    }));
  };

  const handleSaveSeatLayout = async () => {
    if (!seatEditBusId) return;
    const bus = buses.find((b) => Number(b.id) === Number(seatEditBusId));
    await db.update('buses', seatEditBusId, { seat_config: seatDraft });
    await db.logAudit(user, 'SEAT_LAYOUT_UPDATED', `Updated seat layout for ${bus?.bus_number} (${computeBusCapacity(seatDraft).totalSeats} seats).`);
    showToast(`✅ Saved custom seat layout for ${bus?.bus_number}! Students see it immediately.`);
    loadData();
  };

  // Broadcast Notice
  const handleSendNotice = async (e) => {
    e.preventDefault();
    if (!noticeForm.title || !noticeForm.message) return;
    await db.insert('notices', { ...noticeForm, created_by: user.name });
    await db.logAudit(user, 'NOTICE_BROADCAST', `Published notice: ${noticeForm.title}`);
    setNoticeForm({ title: '', message: '', priority: 'normal' });
    showToast('📢 Live Notice broadcast to all Students & Drivers!');
  };

  // Resolve SOS
  const handleResolveSOS = async (id) => {
    await db.update('sos_alerts', id, { status: 'resolved' });
    await db.logAudit(user, 'SOS_RESOLVED', `Resolved SOS Alert #${id}.`);
    showToast('✅ SOS alert marked as resolved.');
    loadData();
  };

  // Add Bus
  const handleAddBus = async (e) => {
    e.preventDefault();
    if (!newBus.bus_number) return;
    const { error } = await db.insert('buses', {
      bus_number: newBus.bus_number.trim(),
      plate_no: newBus.plate_no.trim() || 'Dhaka Metro Ba 11-XXXX',
      route_id: newBus.route_id ? Number(newBus.route_id) : null,
      driver_id: newBus.driver_id ? Number(newBus.driver_id) : null,
      status: 'standby',
      current_lat: 23.8769,
      current_lng: 90.3202,
      speed_kmh: 0,
      seat_config: DEFAULT_SEAT_CONFIG,
      fitness_expiry: newBus.fitness_expiry || '2027-12-31',
    });
    if (error) { showToast(`⚠️ ${error}`); return; }
    await db.logAudit(user, 'BUS_ADDED', `Added ${newBus.bus_number} to DIU fleet.`);
    setNewBus({ bus_number: '', plate_no: '', route_id: '', driver_id: '', fitness_expiry: '2027-12-31' });
    showToast(`🚌 New bus added successfully!`);
    loadData();
  };

  const handleUpdateBusField = async (busId, patch, label) => {
    await db.update('buses', busId, patch);
    await db.logAudit(user, 'BUS_MODIFIED', `Updated Bus #${busId}: ${label}`);
    showToast(`✅ ${label} updated!`);
    loadData();
  };

  const handleDeleteBus = async (bus) => {
    if (!confirm(`Delete ${bus.bus_number} permanently?`)) return;
    await db.remove('buses', bus.id);
    await db.logAudit(user, 'BUS_DELETED', `Deleted ${bus.bus_number}`);
    showToast(`Deleted ${bus.bus_number}.`);
    loadData();
  };

  // Route Management & Stoppage Editor
  const handleAddRoute = async (e) => {
    e.preventDefault();
    if (!newRoute.name || !newRoute.start_point) return;
    const schedulesArr = newRoute.schedules.split(',').map((s) => s.trim()).filter(Boolean);
    const defaultStoppages = [
      { name: newRoute.start_point.trim(), offset_min: 0, lat: 23.7900, lng: 90.3600 },
      { name: newRoute.end_point.trim() || 'DIU Smart City', offset_min: 45, lat: 23.8769, lng: 90.3202 },
    ];
    await db.insert('routes', {
      name: newRoute.name.trim(),
      start_point: newRoute.start_point.trim(),
      end_point: newRoute.end_point.trim() || 'DIU Smart City',
      schedules: schedulesArr.length ? schedulesArr : ['07:30 AM', '01:30 PM'],
      stoppages: defaultStoppages,
      status: 'active',
    });
    await db.logAudit(user, 'ROUTE_CREATED', `Created new route: ${newRoute.name}`);
    setNewRoute({ name: '', start_point: '', end_point: 'DIU Smart City', schedules: '07:15 AM, 01:30 PM, 04:30 PM' });
    showToast('✅ New route created! You can now customize its stoppages.');
    loadData();
  };

  const startEditRoute = (r) => {
    setEditingRouteId(r.id);
    setRouteEditDraft({
      name: r.name || '',
      start_point: r.start_point || '',
      end_point: r.end_point || '',
      schedules: Array.isArray(r.schedules) ? r.schedules.join(', ') : '',
      stoppages: Array.isArray(r.stoppages) ? r.stoppages.map((s) => ({ ...s })) : [],
    });
  };

  const handleAddStoppageToDraft = () => {
    if (!newStop.name.trim()) return;
    setRouteEditDraft((prev) => ({
      ...prev,
      stoppages: [
        ...prev.stoppages,
        {
          name: newStop.name.trim(),
          offset_min: Number(newStop.offset_min) || 0,
          lat: Number(newStop.lat) || 23.85,
          lng: Number(newStop.lng) || 90.33,
        },
      ],
    }));
    setNewStop({ name: '', offset_min: '20', lat: '23.8550', lng: '90.3320' });
  };

  const handleUpdateStoppageItem = (idx, field, val) => {
    setRouteEditDraft((prev) => {
      const next = [...prev.stoppages];
      next[idx] = { ...next[idx], [field]: field === 'name' ? val : Number(val) };
      return { ...prev, stoppages: next };
    });
  };

  const handleRemoveStoppageItem = (idx) => {
    setRouteEditDraft((prev) => ({
      ...prev,
      stoppages: prev.stoppages.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveRouteEdits = async () => {
    if (!editingRouteId) return;
    const schedulesArr = routeEditDraft.schedules.split(',').map((s) => s.trim()).filter(Boolean);
    await db.update('routes', editingRouteId, {
      name: routeEditDraft.name.trim(),
      start_point: routeEditDraft.start_point.trim(),
      end_point: routeEditDraft.end_point.trim(),
      schedules: schedulesArr,
      stoppages: routeEditDraft.stoppages,
    });
    await db.logAudit(user, 'ROUTE_STOPPAGES_UPDATED', `Updated route & stoppages for ${routeEditDraft.name}`);
    setEditingRouteId(null);
    showToast('✅ Route & Stoppages saved live!');
    loadData();
  };

  const handleDeleteRoute = async (r) => {
    if (!confirm(`Delete route "${r.name}"?`)) return;
    await db.remove('routes', r.id);
    showToast('Route deleted.');
    loadData();
  };

  // Driver CRUD via Zero-Trust Server RPC
  const handleSaveDriver = async (e) => {
    e.preventDefault();
    if (!driverForm.name || !driverForm.phone || !driverForm.license_no) return;
    const action = driverEditId ? 'update' : 'create';
    const { error } = await db.manageDriver(action, {
      id: driverEditId,
      ...driverForm,
    });
    if (error) { showToast(`⚠️ ${error}`); return; }
    showToast(driverEditId ? '✅ Driver & Helper details updated!' : '✅ New Driver & Helper added securely!');
    setDriverEditId(null);
    setDriverForm({ name: '', phone: '', email: '', license_no: '', helper_name: '', helper_phone: '', home_address: '', password: '123456' });
    loadData();
  };

  const handleDeleteDriver = async (drv) => {
    if (!confirm(`Delete driver ${drv.name}? Their assigned bus will become unassigned.`)) return;
    const { error } = await db.manageDriver('delete', { id: drv.id });
    if (error) { showToast(`⚠️ ${error}`); return; }
    showToast('Driver removed safely.');
    loadData();
  };

  // Issue Cryptographically Unique Verification Code via Zero-Trust Server RPC
  const handleIssueCode = async (e) => {
    e.preventDefault();
    const { data, error } = await db.issueFeeCode({
      role: codeRole,
      assigned_uni_id: codeRole === 'student' ? codeAssignedName.trim() : '',
      assigned_name: codeRole !== 'student' ? codeAssignedName.trim() : '',
    });
    if (error || !data) { showToast(`⚠️ ${error || 'Failed to issue code'}`); return; }
    setCodeAssignedName('');
    showToast(`🔑 Generated Unique ${codeRole.toUpperCase()} Code: ${data.code}`);
    loadData();
  };

  const activeSOS = sosAlerts.filter((a) => a.status === 'active');
  const highDemandBuses = buses.filter((b) => {
    const cap = computeBusCapacity(b.seat_config).totalSeats;
    const count = bookings.filter((bk) => Number(bk.bus_id) === Number(b.id)).length;
    return cap > 0 && count / cap >= 0.9;
  });

  if (!user) return null;

  return (
    <div className="min-h-screen pb-14 px-3 sm:px-6 pt-4">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Bar */}
        <header className="glass-panel px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">
                Transport Control Room
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Controller: {user.name} • Hotline: {user.phone || 'Active'}
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

        {/* ACTIVE SOS EMERGENCY BANNER */}
        {activeSOS.length > 0 && (
          <div className="space-y-2">
            {activeSOS.map((sos) => (
              <div key={sos.id} className="rounded-2xl bg-rose-600 text-white p-4 shadow-lg flex flex-wrap items-center justify-between gap-3 border-2 border-rose-300">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-6 h-6 shrink-0 animate-bounce mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <div className="font-extrabold text-sm">
                      🚨 LIVE SOS: {sos.category} — {sos.bus_number}
                    </div>
                    <div>
                      Reporter: <b>{sos.reporter_name}</b> ({sos.reporter_role}) • Phone: <b>{sos.reporter_phone}</b>
                      {sos.reporter_dept && ` • ${sos.reporter_dept} B-${sos.reporter_batch}`}
                    </div>
                    <div>
                      Emergency / Guardian Contact: <b>{sos.guardian_phone || 'N/A'}</b> • Note: &ldquo;{sos.message}&rdquo;
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sos.bus_id && (
                    <button
                      onClick={() => { setActiveTab('live'); setTrackBusId(sos.bus_id); }}
                      className="px-3 py-1.5 rounded-xl bg-white text-rose-700 text-xs font-extrabold cursor-pointer"
                    >
                      Track Bus
                    </button>
                  )}
                  <button
                    onClick={() => handleResolveSOS(sos.id)}
                    className="px-3 py-1.5 rounded-xl bg-rose-900/70 hover:bg-rose-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Smart Capacity Alert (>=90% Full) */}
        {highDemandBuses.length > 0 && (
          <div className="glass-card px-4 py-3 border-l-4 border-l-amber-500 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            High Demand Alert: {highDemandBuses.map((b) => b.bus_number).join(', ')} reached 90%+ capacity — Deploy Standby Bus!
          </div>
        )}

        {toast && (
          <div className="glass-panel px-4 py-3 text-xs sm:text-sm font-bold border-l-4 border-l-emerald-500">
            {toast}
          </div>
        )}

        {/* Command Navigation Tabs */}
        <nav className="flex flex-wrap gap-2">
          {[
            { id: 'live', label: 'Live Fleet Map', icon: MapPin },
            { id: 'fleet', label: 'Buses & Route Assign', icon: Bus },
            { id: 'routes', label: 'Routes & Stoppages', icon: Route },
            { id: 'seats', label: 'Seat Layout Editor', icon: Armchair },
            { id: 'drivers', label: 'Drivers & Codes', icon: Users },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'glass-btn-primary'
                    : 'glass-card text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* ==================== TAB 1: LIVE FLEET MAP (ALL + INDIVIDUAL) ==================== */}
        {activeTab === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 glass-card p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">
                    Live Fleet Radar — All Buses & Individual Bus Tracking
                  </h2>
                  <p className="text-[11px] text-slate-500">Switch between full campus fleet view or lock onto a single bus.</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setTrackBusId(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      trackBusId === null ? 'glass-btn-primary' : 'glass-btn text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    All Buses ({buses.length})
                  </button>
                  {buses.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setTrackBusId(b.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        Number(trackBusId) === Number(b.id) ? 'glass-btn-primary' : 'glass-btn text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {b.bus_number}
                    </button>
                  ))}
                </div>
              </div>

              <LiveBusMap
                buses={buses}
                routes={routes}
                selectedBusId={trackBusId}
                height="400px"
                onSelectBus={(b) => setTrackBusId(b.id)}
              />
            </div>

            <div className="lg:col-span-4 space-y-4">
              {/* Live Fleet List */}
              <div className="glass-card p-4 space-y-2.5 max-h-[300px] overflow-y-auto">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Click Any Bus to Track</h3>
                {buses.map((b) => {
                  const drv = drivers.find((d) => Number(d.id) === Number(b.driver_id));
                  const rt = routes.find((r) => Number(r.id) === Number(b.route_id));
                  const bkCount = bookings.filter((bk) => Number(bk.bus_id) === Number(b.id)).length;
                  const cap = computeBusCapacity(b.seat_config).totalSeats;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setTrackBusId(b.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        Number(trackBusId) === Number(b.id)
                          ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-800'
                          : 'bg-white/55 dark:bg-slate-800/55 border-white/70 dark:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold">
                        <span>🚌 {b.bus_number}</span>
                        <span>{bkCount}/{cap} Seats</span>
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5">{rt?.name || 'No Route'}</div>
                      <div className="text-[10px] opacity-75 mt-1 flex items-center justify-between">
                        <span>Driver: {drv?.name || 'Unassigned'}</span>
                        {drv?.phone && (
                          <a href={`tel:${drv.phone}`} onClick={(e) => e.stopPropagation()} className="underline font-bold">
                            Call {drv.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Broadcast Notice */}
              <form onSubmit={handleSendNotice} className="glass-card p-4 space-y-2.5">
                <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-slate-800 dark:text-white">
                  <Megaphone className="w-4 h-4" /> Broadcast Live Notice
                </h3>
                <input
                  type="text"
                  required
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  placeholder="Notice headline (e.g. Heavy Rain Delay)"
                  className="glass-input w-full px-3 py-2 text-xs"
                />
                <textarea
                  rows={2}
                  required
                  value={noticeForm.message}
                  onChange={(e) => setNoticeForm({ ...noticeForm, message: e.target.value })}
                  placeholder="Message for all Students & Drivers..."
                  className="glass-input w-full px-3 py-2 text-xs"
                />
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={noticeForm.priority}
                    onChange={(e) => setNoticeForm({ ...noticeForm, priority: e.target.value })}
                    className="glass-input px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="urgent">Urgent Alert</option>
                  </select>
                  <button type="submit" className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
                    Publish Notice
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: BUSES & ROUTE ASSIGNMENT ==================== */}
        {activeTab === 'fleet' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form onSubmit={handleAddBus} className="lg:col-span-4 glass-card p-5 space-y-3 h-fit">
              <h2 className="text-sm font-extrabold flex items-center gap-2 text-slate-800 dark:text-white">
                <Plus className="w-4 h-4" /> Add New Bus to Fleet
              </h2>
              <div>
                <label className="text-[11px] font-bold text-slate-500">Sequential Bus Number *</label>
                <input
                  type="text"
                  required
                  value={newBus.bus_number}
                  onChange={(e) => setNewBus({ ...newBus, bus_number: e.target.value })}
                  placeholder="e.g. Bus-05"
                  className="glass-input w-full px-3 py-2 text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">Registration Plate No</label>
                <input
                  type="text"
                  value={newBus.plate_no}
                  onChange={(e) => setNewBus({ ...newBus, plate_no: e.target.value })}
                  placeholder="Dhaka Metro Ba 11-4025"
                  className="glass-input w-full px-3 py-2 text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">Assign Route</label>
                <select
                  value={newBus.route_id}
                  onChange={(e) => setNewBus({ ...newBus, route_id: e.target.value })}
                  className="glass-input w-full px-3 py-2 text-xs mt-1"
                >
                  <option value="">-- Select Route --</option>
                  {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">Assign Driver</label>
                <select
                  value={newBus.driver_id}
                  onChange={(e) => setNewBus({ ...newBus, driver_id: e.target.value })}
                  className="glass-input w-full px-3 py-2 text-xs mt-1"
                >
                  <option value="">-- Unassigned --</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>)}
                </select>
              </div>
              <button type="submit" className="glass-btn-primary w-full py-2.5 rounded-xl text-xs font-bold cursor-pointer">
                Add Bus to Fleet
              </button>
            </form>

            <div className="lg:col-span-8 space-y-3">
              {buses.map((b) => {
                const cap = computeBusCapacity(b.seat_config).totalSeats;
                return (
                  <div key={b.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-800 dark:text-white">🚌 {b.bus_number}</span>
                        <span className="text-[11px] text-slate-500">{b.plate_no}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700">
                          {cap} Seats
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Fitness Valid Until: {b.fitness_expiry || '2027-06-30'}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Change Bus Route Instantly */}
                      <select
                        value={b.route_id || ''}
                        onChange={(e) => handleUpdateBusField(b.id, { route_id: e.target.value ? Number(e.target.value) : null }, `${b.bus_number} route`)}
                        className="glass-input px-2.5 py-1.5 text-xs font-semibold"
                        title="Change Bus Route"
                      >
                        <option value="">No Route</option>
                        {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>

                      {/* Change Bus Driver Instantly */}
                      <select
                        value={b.driver_id || ''}
                        onChange={(e) => handleUpdateBusField(b.id, { driver_id: e.target.value ? Number(e.target.value) : null }, `${b.bus_number} driver`)}
                        className="glass-input px-2.5 py-1.5 text-xs font-semibold"
                        title="Assign Driver"
                      >
                        <option value="">No Driver</option>
                        {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>

                      {/* Status */}
                      <select
                        value={b.status || 'standby'}
                        onChange={(e) => handleUpdateBusField(b.id, { status: e.target.value }, `${b.bus_number} status`)}
                        className="glass-input px-2.5 py-1.5 text-xs font-bold"
                      >
                        <option value="active">Active</option>
                        <option value="standby">Standby</option>
                        <option value="maintenance">Maintenance</option>
                      </select>

                      <button
                        onClick={() => handleDeleteBus(b)}
                        className="p-2 rounded-xl bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 cursor-pointer"
                        title="Delete Bus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: ROUTES & STOPPAGES EDITOR (CONTROLLER ONLY) ==================== */}
        {activeTab === 'routes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form onSubmit={handleAddRoute} className="lg:col-span-4 glass-card p-5 space-y-3 h-fit">
              <h2 className="text-sm font-extrabold flex items-center gap-2 text-slate-800 dark:text-white">
                <Plus className="w-4 h-4" /> Create New Route
              </h2>
              <input
                type="text"
                required
                value={newRoute.name}
                onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
                placeholder="Route Name (e.g. Mohammadpur ↔ DIU)"
                className="glass-input w-full px-3 py-2 text-xs"
              />
              <input
                type="text"
                required
                value={newRoute.start_point}
                onChange={(e) => setNewRoute({ ...newRoute, start_point: e.target.value })}
                placeholder="Start Point (e.g. Mohammadpur Bus Stand)"
                className="glass-input w-full px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newRoute.end_point}
                onChange={(e) => setNewRoute({ ...newRoute, end_point: e.target.value })}
                placeholder="End Point (DIU Smart City)"
                className="glass-input w-full px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newRoute.schedules}
                onChange={(e) => setNewRoute({ ...newRoute, schedules: e.target.value })}
                placeholder="Schedules (comma separated)"
                className="glass-input w-full px-3 py-2 text-xs"
              />
              <button type="submit" className="glass-btn-primary w-full py-2.5 rounded-xl text-xs font-bold cursor-pointer">
                Add Route
              </button>
            </form>

            <div className="lg:col-span-8 space-y-4">
              {routes.map((r) => {
                const isEditing = editingRouteId === r.id;
                return (
                  <div key={r.id} className="glass-card p-4 sm:p-5 space-y-3">
                    {!isEditing ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">{r.name}</h3>
                            <p className="text-[11px] text-slate-500">
                              Schedules: {(r.schedules || []).join(' • ')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditRoute(r)}
                              className="glass-btn px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit Route & Stoppages
                            </button>
                            <button
                              onClick={() => handleDeleteRoute(r)}
                              className="p-2 rounded-xl bg-rose-500/15 text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {(r.stoppages || []).map((s, idx) => (
                            <span key={idx} className="px-2.5 py-1 rounded-lg bg-white/60 dark:bg-slate-800/60 text-[11px] font-semibold border border-white/70 dark:border-white/10">
                              {idx + 1}. {s.name} (+{s.offset_min || 0}m)
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
                            Editing Route & Stoppages
                          </h3>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingRouteId(null)} className="glass-btn px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                            <button onClick={handleSaveRouteEdits} className="glass-btn-primary px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                              <Save className="w-3.5 h-3.5" /> Save Changes
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={routeEditDraft.name}
                            onChange={(e) => setRouteEditDraft({ ...routeEditDraft, name: e.target.value })}
                            placeholder="Route Name"
                            className="glass-input px-3 py-2 text-xs font-bold"
                          />
                          <input
                            type="text"
                            value={routeEditDraft.schedules}
                            onChange={(e) => setRouteEditDraft({ ...routeEditDraft, schedules: e.target.value })}
                            placeholder="07:00 AM, 01:30 PM, 04:30 PM"
                            className="glass-input px-3 py-2 text-xs"
                          />
                        </div>

                        {/* Existing Stoppages Editable List */}
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold uppercase text-slate-500">Stoppages List (Editable)</div>
                          {routeEditDraft.stoppages.map((st, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                              <input
                                type="text"
                                value={st.name}
                                onChange={(e) => handleUpdateStoppageItem(idx, 'name', e.target.value)}
                                className="col-span-5 glass-input px-2.5 py-1.5 text-xs font-semibold"
                              />
                              <input
                                type="number"
                                value={st.offset_min}
                                onChange={(e) => handleUpdateStoppageItem(idx, 'offset_min', e.target.value)}
                                className="col-span-2 glass-input px-2 py-1.5 text-xs"
                                title="ETA Minutes"
                              />
                              <input
                                type="number"
                                step="0.0001"
                                value={st.lat}
                                onChange={(e) => handleUpdateStoppageItem(idx, 'lat', e.target.value)}
                                className="col-span-2 glass-input px-2 py-1.5 text-xs"
                                title="Latitude"
                              />
                              <input
                                type="number"
                                step="0.0001"
                                value={st.lng}
                                onChange={(e) => handleUpdateStoppageItem(idx, 'lng', e.target.value)}
                                className="col-span-2 glass-input px-2 py-1.5 text-xs"
                                title="Longitude"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveStoppageItem(idx)}
                                className="col-span-1 p-1.5 rounded-lg bg-rose-500/15 text-rose-600 flex justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add New Stoppage */}
                        <div className="pt-2 border-t border-slate-300/50 dark:border-slate-700/60 grid grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            value={newStop.name}
                            onChange={(e) => setNewStop({ ...newStop, name: e.target.value })}
                            placeholder="New Stoppage Name (e.g. Technical)"
                            className="col-span-5 glass-input px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="number"
                            value={newStop.offset_min}
                            onChange={(e) => setNewStop({ ...newStop, offset_min: e.target.value })}
                            placeholder="Min"
                            className="col-span-2 glass-input px-2 py-1.5 text-xs"
                          />
                          <input
                            type="number"
                            step="0.0001"
                            value={newStop.lat}
                            onChange={(e) => setNewStop({ ...newStop, lat: e.target.value })}
                            placeholder="Lat"
                            className="col-span-2 glass-input px-2 py-1.5 text-xs"
                          />
                          <input
                            type="number"
                            step="0.0001"
                            value={newStop.lng}
                            onChange={(e) => setNewStop({ ...newStop, lng: e.target.value })}
                            placeholder="Lng"
                            className="col-span-2 glass-input px-2 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={handleAddStoppageToDraft}
                            className="col-span-1 p-1.5 rounded-lg glass-btn-primary flex justify-center cursor-pointer"
                            title="Add Stoppage"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: CUSTOM BUS SEAT LAYOUT EDITOR ==================== */}
        {activeTab === 'seats' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 glass-card p-5 space-y-4 h-fit">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <Armchair className="w-4 h-4" /> Custom Passenger Seat Cabin Builder
                </h2>
                <p className="text-[11px] text-slate-500 mt-1">
                  Main Entry Door, Engine Bay, and Driver Seat remain permanently fixed. Customize passenger rows, columns, and click individual seats on the preview to remove/restore them.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Select Bus to Customize</label>
                <select
                  value={seatEditBusId || ''}
                  onChange={(e) => handlePickSeatBus(Number(e.target.value))}
                  className="glass-input w-full px-3 py-2.5 text-xs font-bold mt-1"
                >
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bus_number} (Current: {computeBusCapacity(b.seat_config).totalSeats} Seats)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Rows (4–15)</label>
                  <input
                    type="number"
                    min={4}
                    max={15}
                    value={seatDraft.rows}
                    onChange={(e) => setSeatDraft({ ...seatDraft, rows: Number(e.target.value) })}
                    className="glass-input w-full px-3 py-2 text-xs font-bold mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Left Cols (1–3)</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={seatDraft.leftCols}
                    onChange={(e) => setSeatDraft({ ...seatDraft, leftCols: Number(e.target.value) })}
                    className="glass-input w-full px-3 py-2 text-xs font-bold mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Right Cols (1–3)</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={seatDraft.rightCols}
                    onChange={(e) => setSeatDraft({ ...seatDraft, rightCols: Number(e.target.value) })}
                    className="glass-input w-full px-3 py-2 text-xs font-bold mt-1"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(seatDraft.backBench)}
                  onChange={(e) => setSeatDraft({ ...seatDraft, backBench: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                Include Full Rear Bench Row
              </label>

              {/* Gender Seat Brush Selector */}
              <div className="space-y-2 pt-1">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  1. Pick Seat Tool & Click Seats on Bus Preview:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSeatBrush('female')}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      seatBrush === 'female'
                        ? 'bg-pink-600 text-white border-pink-600 shadow-sm'
                        : 'glass-card text-pink-700 dark:text-pink-300'
                    }`}
                  >
                    👩 Female Reserved (Pink)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeatBrush('male')}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      seatBrush === 'male'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                        : 'glass-card text-sky-700 dark:text-sky-300'
                    }`}
                  >
                    👨 Male Reserved (Blue)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeatBrush('general')}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      seatBrush === 'general'
                        ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'glass-card text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    ⚪ White / General (Any)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeatBrush('disable')}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      seatBrush === 'disable'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'glass-card text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    🚫 Disable / Remove Seat
                  </button>
                </div>
              </div>

              {/* Quick Gender & Layout Presets */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500">Quick Presets:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyFrontRowsFemalePreset(3)}
                    className="px-2.5 py-1.5 rounded-lg bg-pink-500/15 border border-pink-500/40 text-pink-700 dark:text-pink-300 text-[11px] font-bold cursor-pointer"
                  >
                    Front 3 Rows Female
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeatDraft((p) => ({ ...p, femaleSeats: [], maleSeats: [] }))}
                    className="glass-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    Reset All White
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeatDraft({ rows: 10, leftCols: 2, rightCols: 2, backBench: false, disabledSeats: [], femaleSeats: [], maleSeats: [] })}
                    className="glass-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    Standard 2+2 (40)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeatDraft({ rows: 9, leftCols: 2, rightCols: 3, backBench: true, disabledSeats: [], femaleSeats: [], maleSeats: [] })}
                    className="glass-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    Large 2+3 (51)
                  </button>
                </div>
              </div>

              <button
                onClick={handleSaveSeatLayout}
                className="glass-btn-primary w-full py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save Seat Layout ({computeBusCapacity(seatDraft).totalSeats} Active Seats)
              </button>
            </div>

            <div className="lg:col-span-7 glass-card p-5">
              <BusSeatLayout
                busNumber={buses.find((b) => Number(b.id) === Number(seatEditBusId))?.bus_number || 'Bus'}
                seatConfig={seatDraft}
                mode="edit"
                onEditSeatClick={handleApplySeatBrush}
              />
            </div>
          </div>
        )}

        {/* ==================== TAB 5: DRIVERS CRUD & OFFICE CODES ==================== */}
        {activeTab === 'drivers' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 space-y-5">
              {/* Add / Edit Driver Form */}
              <form onSubmit={handleSaveDriver} className="glass-card p-5 space-y-3">
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">
                  {driverEditId ? 'Edit Driver & Helper Details' : 'Manually Add New Driver & Helper'}
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  <input type="text" required value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} placeholder="Driver Name *" className="glass-input px-3 py-2 text-xs" />
                  <input type="tel" required value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })} placeholder="Driver Phone *" className="glass-input px-3 py-2 text-xs" />
                  <input type="text" required value={driverForm.license_no} onChange={(e) => setDriverForm({ ...driverForm, license_no: e.target.value })} placeholder="Driving License No *" className="glass-input px-3 py-2 text-xs" />
                  <input type="text" value={driverForm.home_address} onChange={(e) => setDriverForm({ ...driverForm, home_address: e.target.value })} placeholder="Home Address" className="glass-input px-3 py-2 text-xs" />
                  <input type="text" required value={driverForm.helper_name} onChange={(e) => setDriverForm({ ...driverForm, helper_name: e.target.value })} placeholder="Helper Name *" className="glass-input px-3 py-2 text-xs" />
                  <input type="tel" required value={driverForm.helper_phone} onChange={(e) => setDriverForm({ ...driverForm, helper_phone: e.target.value })} placeholder="Helper Phone *" className="glass-input px-3 py-2 text-xs" />
                </div>
                {!driverEditId && (
                  <input type="text" value={driverForm.password} onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })} placeholder="Initial Password (default: 1234)" className="glass-input w-full px-3 py-2 text-xs" />
                )}
                <div className="flex gap-2">
                  {driverEditId && (
                    <button type="button" onClick={() => { setDriverEditId(null); setDriverForm({ name: '', phone: '', email: '', license_no: '', helper_name: '', helper_phone: '', home_address: '', password: '1234' }); }} className="glass-btn px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="glass-btn-primary flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer">
                    {driverEditId ? 'Update Driver Details' : 'Add Driver & Helper'}
                  </button>
                </div>
              </form>

              {/* Quick Office Code Issuer */}
              <form onSubmit={handleIssueCode} className="glass-card p-5 space-y-3">
                <h3 className="text-sm font-extrabold flex items-center gap-1.5 text-slate-800 dark:text-white">
                  <KeyRound className="w-4 h-4" /> Issue Registration Code
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <select value={codeRole} onChange={(e) => setCodeRole(e.target.value)} className="glass-input px-3 py-2 text-xs font-bold">
                    <option value="student">Student Code</option>
                    <option value="driver">Driver Code</option>
                    <option value="controller">Controller Code</option>
                  </select>
                  <input type="text" value={codeAssignedName} onChange={(e) => setCodeAssignedName(e.target.value)} placeholder={codeRole === "student" ? "Student ID (e.g. 241-35-489)" : "Staff Name"} className="glass-input px-3 py-2 text-xs" />
                </div>
                <button type="submit" className="glass-btn-primary w-full py-2.5 rounded-xl text-xs font-bold cursor-pointer">
                  Generate New Code
                </button>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                  {codes.slice(0, 6).map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-white/55 dark:bg-slate-800/55">
                      <span className="font-mono font-bold">{c.code}</span>
                      <span className="uppercase text-[10px] text-slate-500">{c.role}</span>
                      <span className={c.is_used ? 'text-rose-500 font-bold' : 'text-emerald-600 font-bold'}>
                        {c.is_used ? 'Used' : 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              </form>
            </div>

            {/* Drivers Directory */}
            <div className="lg:col-span-7 space-y-3">
              {drivers.map((d) => {
                const assignedBus = buses.find((b) => Number(b.driver_id) === Number(d.id));
                return (
                  <div key={d.id} className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-800 dark:text-white">{d.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700">
                          {assignedBus ? assignedBus.bus_number : 'Unassigned'}
                        </span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">
                        License: <b>{d.license_no || 'N/A'}</b> • Mobile: <b>{d.phone}</b>
                      </div>
                      <div className="text-slate-500">
                        Helper: <b>{d.helper_name || 'N/A'}</b> ({d.helper_phone || '—'}) • Address: {d.home_address || '—'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {d.phone && (
                        <a href={`tel:${d.phone}`} className="glass-btn px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1">
                          <PhoneCall className="w-3.5 h-3.5" /> Call
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setDriverEditId(d.id);
                          setDriverForm({
                            name: d.name || '',
                            phone: d.phone || '',
                            email: d.email || '',
                            license_no: d.license_no || '',
                            helper_name: d.helper_name || '',
                            helper_phone: d.helper_phone || '',
                            home_address: d.home_address || '',
                            password: '',
                          });
                        }}
                        className="glass-btn p-2 rounded-xl cursor-pointer"
                        title="Customize Driver"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDriver(d)}
                        className="p-2 rounded-xl bg-rose-500/15 text-rose-600 cursor-pointer"
                        title="Delete Driver"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
