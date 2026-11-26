'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bus, Navigation, Play, Square, AlertTriangle, PhoneCall,
  LogOut, ShieldAlert, Users, Megaphone, Radio, CheckCircle2
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LiveBusMap from '@/components/LiveBusMap';
import { db } from '@/lib/supabase';
import { getVerifiedSession, clearSession, getDashboardPath } from '@/lib/auth';

export default function DriverDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [controllers, setControllers] = useState([]);
  const [notices, setNotices] = useState([]);

  const [selectedBusId, setSelectedBusId] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [realGpsActive, setRealGpsActive] = useState(false);
  const [toast, setToast] = useState('');
  const [sosOpen, setSosOpen] = useState(false);
  const [sosCategory, setSosCategory] = useState('Bus Breakdown');
  const [sosMessage, setSosMessage] = useState('');

  const simIndexRef = useRef(0);
  const watchIdRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);

  const loadData = useCallback(async (sessionUser) => {
    const [bList, rList, bkList, uList, nList] = await Promise.all([
      db.getAll('buses', 'id', true),
      db.getAll('routes', 'id', true),
      db.getAll('bookings', 'id', true),
      db.getAll('users', 'id', true),
      db.getAll('notices', 'id', false),
    ]);
    setBuses(bList);
    setRoutes(rList);
    setBookings(bkList.filter((b) => !b.booking_date || b.booking_date === today));
    // PRIVACY RULE: Drivers ONLY receive Transport Controller phone numbers (never student personal numbers)
    setControllers(uList.filter((u) => u.role === 'controller'));
    setNotices(nList);

    const activeUser = sessionUser || (await getVerifiedSession());
    setSelectedBusId((prev) => {
      if (prev && bList.some((b) => Number(b.id) === Number(prev))) return prev;
      const assigned = bList.find((b) => Number(b.driver_id) === Number(activeUser?.id));
      return assigned?.id || bList[0]?.id || null;
    });
  }, [today]);

  useEffect(() => {
    let active = true;
    let poll;
    (async () => {
      const session = await getVerifiedSession();
      if (!active) return;
      if (!session) {
        router.replace('/');
        return;
      }
      if (session.role !== 'driver') {
        router.replace(getDashboardPath(session.role));
        return;
      }
      setUser(session);
      loadData(session);
      poll = setInterval(() => loadData(session), 5000);
    })();
    return () => {
      active = false;
      if (poll) clearInterval(poll);
      if (watchIdRef.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [router, loadData]);

  const myBus = buses.find((b) => Number(b.id) === Number(selectedBusId)) || buses[0] || null;
  const myRoute = myBus ? routes.find((r) => Number(r.id) === Number(myBus.route_id)) : null;
  const bookedCount = bookings.filter((b) => Number(b.bus_id) === Number(myBus?.id)).length;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // [DEMO ROUTE SIMULATOR] Moves bus smoothly along its assigned route stoppages for indoor Dean presentation
  useEffect(() => {
    if (!simulating || !myBus) return;
    const stoppages = Array.isArray(myRoute?.stoppages) && myRoute.stoppages.length >= 2
      ? myRoute.stoppages
      : [
          { lat: 23.7516, lng: 90.3761 },
          { lat: 23.7837, lng: 90.3442 },
          { lat: 23.8542, lng: 90.3315 },
          { lat: 23.8769, lng: 90.3202 },
        ];

    const timer = setInterval(async () => {
      const idx = simIndexRef.current % stoppages.length;
      const nextIdx = (idx + 1) % stoppages.length;
      const p1 = stoppages[idx];
      const p2 = stoppages[nextIdx];
      const midLat = (Number(p1.lat) + Number(p2.lat)) / 2 + (Math.random() - 0.5) * 0.001;
      const midLng = (Number(p1.lng) + Number(p2.lng)) / 2 + (Math.random() - 0.5) * 0.001;
      simIndexRef.current += 1;

      await db.update('buses', myBus.id, {
        status: 'active',
        current_lat: midLat,
        current_lng: midLng,
        speed_kmh: 32 + Math.floor(Math.random() * 18),
        updated_at: new Date().toISOString(),
      });
      await loadData();
    }, 3000);

    return () => clearInterval(timer);
  }, [simulating, myBus?.id, myRoute?.id, loadData]);

  // Real Device GPS Broadcast
  const toggleRealGps = async () => {
    if (!myBus) return;
    if (realGpsActive) {
      if (watchIdRef.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      setRealGpsActive(false);
      await db.update('buses', myBus.id, { status: 'standby', speed_kmh: 0 });
      showToast('Live GPS stopped. Bus set to Standby.');
      loadData();
      return;
    }
    if (!navigator.geolocation) {
      showToast('GPS not supported on this device. Use Demo Route Simulation instead.');
      return;
    }
    setSimulating(false);
    setRealGpsActive(true);
    showToast('📡 Broadcasting real device GPS live to Students & Control Room...');
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        await db.update('buses', myBus.id, {
          status: 'active',
          current_lat: pos.coords.latitude,
          current_lng: pos.coords.longitude,
          speed_kmh: Math.round((pos.coords.speed || 8) * 3.6),
          updated_at: new Date().toISOString(),
        });
        loadData();
      },
      () => {
        showToast('GPS permission denied. You can use Demo Route Simulation.');
        setRealGpsActive(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const toggleSimulation = async () => {
    if (!myBus) return;
    if (simulating) {
      setSimulating(false);
      await db.update('buses', myBus.id, { status: 'standby', speed_kmh: 0 });
      showToast('Trip simulation stopped.');
      loadData();
    } else {
      setRealGpsActive(false);
      setSimulating(true);
      await db.update('buses', myBus.id, { status: 'active', speed_kmh: 40 });
      showToast(`🚌 ${myBus.bus_number} Live Trip Simulation Started!`);
      loadData();
    }
  };

  const handleSOS = async (e) => {
    e.preventDefault();
    if (!user) return;
    await db.insert('sos_alerts', {
      reporter_id: user.id,
      reporter_name: `${user.name} (Driver)`,
      reporter_role: 'driver',
      reporter_phone: user.phone || 'N/A',
      guardian_phone: `Helper: ${user.helper_name || 'N/A'} (${user.helper_phone || 'N/A'})`,
      bus_id: myBus?.id || null,
      bus_number: myBus?.bus_number || 'Unassigned Bus',
      category: sosCategory,
      message: sosMessage || 'Driver triggered urgent SOS alert on route!',
      lat: myBus?.current_lat || 23.8769,
      lng: myBus?.current_lng || 90.3202,
      status: 'active',
    });
    await db.logAudit(user, 'DRIVER_SOS', `Driver ${user.name} triggered ${sosCategory} on ${myBus?.bus_number}.`);
    setSosOpen(false);
    setSosMessage('');
    showToast('🚨 Emergency SOS transmitted to DIU Transport Controller & Admin!');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pb-14 px-3 sm:px-6 pt-4">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <header className="glass-panel px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center">
              <Navigation className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">
                Driver Portal — {user.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                License: {user.license_no || 'Verified'} • Helper: {user.helper_name || 'N/A'} ({user.helper_phone || '—'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSosOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md animate-pulse cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" /> SOS
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

        {notices[0] && (
          <div className="glass-card px-4 py-3 flex items-start gap-3 border-l-4 border-l-slate-600">
            <Megaphone className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="text-xs">
              <b>{notices[0].title}:</b> {notices[0].message}
            </div>
          </div>
        )}

        {toast && (
          <div className="glass-panel px-4 py-3 text-xs sm:text-sm font-bold border-l-4 border-l-emerald-500">
            {toast}
          </div>
        )}

        {/* Controls & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 space-y-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase">Assigned Vehicle</div>
                <div className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2 mt-0.5">
                  <Bus className="w-5 h-5" /> {myBus?.bus_number || 'Select Bus'}
                  <span className="text-xs font-semibold text-slate-500">({myBus?.plate_no})</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">Route: <b>{myRoute?.name || 'Unassigned'}</b></div>
              </div>

              <select
                value={selectedBusId || ''}
                onChange={(e) => setSelectedBusId(Number(e.target.value))}
                className="glass-input px-3 py-2 text-xs font-bold"
              >
                {buses.map((b) => (
                  <option key={b.id} value={b.id}>{b.bus_number} ({b.status})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                onClick={toggleRealGps}
                className={`flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  realGpsActive
                    ? 'bg-rose-600 text-white'
                    : 'glass-btn-primary'
                }`}
              >
                {realGpsActive ? <Square className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
                {realGpsActive ? 'Stop Real GPS Broadcast' : 'Start Live Device GPS'}
              </button>

              <button
                onClick={toggleSimulation}
                className={`flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  simulating
                    ? 'bg-amber-600 text-white'
                    : 'glass-btn text-slate-800 dark:text-white'
                }`}
              >
                {simulating ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {simulating ? 'Stop Demo Route Trip' : 'Demo: Simulate Route GPS'}
              </button>
            </div>
          </div>

          <div className="glass-card p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase">Today&apos;s Booked Passengers</div>
              <div className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2 flex items-center gap-2">
                <Users className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                {bookedCount}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Student privacy active: Personal contact numbers are hidden from drivers.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-300/40 dark:border-slate-700/50 text-xs font-bold">
              Speed: {myBus?.speed_kmh || 0} km/h • Status: <span className="uppercase">{myBus?.status}</span>
            </div>
          </div>
        </div>

        {/* Live Map */}
        <div className="glass-card p-4 sm:p-5">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-white mb-3">
            Live GPS Feed — {myBus?.bus_number}
          </h2>
          <LiveBusMap buses={buses} routes={routes} selectedBusId={myBus?.id} height="330px" />
        </div>

        {/* Controller Hotline ONLY (Privacy Enforced) */}
        <div className="glass-card p-4 sm:p-5">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
            <PhoneCall className="w-4 h-4" /> Transport Controller Hotline (Direct Control Room)
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
            Contact the Transport Controller immediately for route changes, traffic diversions, or assistance.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {controllers.map((c) => (
              <div key={c.id} className="bg-white/60 dark:bg-slate-800/60 border border-white/70 dark:border-white/10 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold text-slate-800 dark:text-white">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.phone || 'Control Room'}</div>
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="glass-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5" /> Call Controller
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Driver SOS Modal */}
      {sosOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSOS} className="glass-panel max-w-md w-full p-6 space-y-4 border-2 border-rose-500/50">
            <div className="flex items-center gap-2.5 text-rose-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-extrabold">Driver Emergency SOS Alert</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['Bus Breakdown', 'Road Accident', 'Medical Emergency', 'Security Threat'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSosCategory(cat)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                    sosCategory === cat ? 'bg-rose-600 text-white border-rose-600' : 'glass-card'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={sosMessage}
              onChange={(e) => setSosMessage(e.target.value)}
              placeholder="Describe location or issue for Control Room..."
              className="glass-input w-full p-3 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSosOpen(false)} className="glass-btn px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-extrabold cursor-pointer">🚨 Alert Control Room</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
