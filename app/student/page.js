'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bus, MapPin, Clock, LogOut, PhoneCall, AlertTriangle, QrCode,
  Trash2, ShieldAlert, Megaphone, RefreshCw
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LiveBusMap from '@/components/LiveBusMap';
import BusSeatLayout, { computeBusCapacity } from '@/components/BusSeatLayout';
import { db } from '@/lib/supabase';
import { getVerifiedSession, clearSession, getDashboardPath } from '@/lib/auth';
import { sanitizeText } from '@/lib/security';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [controllers, setControllers] = useState([]);
  const [notices, setNotices] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [selectedBusId, setSelectedBusId] = useState(null);
  const [selectedTime, setSelectedTime] = useState('01:30 PM');
  const [toast, setToast] = useState('');
  const [nowClock, setNowClock] = useState('');

  // SOS Modal
  const [sosOpen, setSosOpen] = useState(false);
  const [sosCategory, setSosCategory] = useState('Security Issue');
  const [sosMessage, setSosMessage] = useState('');
  const [sosSending, setSosSending] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const loadData = useCallback(async () => {
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
    setControllers(uList.filter((u) => u.role === 'controller'));
    setDrivers(uList.filter((u) => u.role === 'driver'));
    setNotices(nList);

    setSelectedBusId((prev) => {
      if (prev && bList.some((x) => Number(x.id) === Number(prev))) return prev;
      return bList[0]?.id || null;
    });
  }, [today]);

  useEffect(() => {
    let active = true;
    let poll, clock;
    (async () => {
      const session = await getVerifiedSession();
      if (!active) return;
      if (!session) {
        router.replace('/');
        return;
      }
      if (session.role !== 'student') {
        router.replace(getDashboardPath(session.role));
        return;
      }
      setUser(session);
      loadData();

      poll = setInterval(loadData, 4000);
      clock = setInterval(() => {
        setNowClock(new Date().toLocaleTimeString('en-BD', { hour12: true }));
      }, 1000);
      setNowClock(new Date().toLocaleTimeString('en-BD', { hour12: true }));
    })();

    return () => {
      active = false;
      if (poll) clearInterval(poll);
      if (clock) clearInterval(clock);
    };
  }, [router, loadData]);

  const selectedBus = buses.find((b) => Number(b.id) === Number(selectedBusId)) || buses[0] || null;
  const selectedRoute = selectedBus
    ? routes.find((r) => Number(r.id) === Number(selectedBus.route_id))
    : null;
  const assignedDriver = selectedBus
    ? drivers.find((d) => Number(d.id) === Number(selectedBus.driver_id))
    : null;

  const schedules = Array.isArray(selectedRoute?.schedules) && selectedRoute.schedules.length > 0
    ? selectedRoute.schedules
    : ['07:30 AM', '01:30 PM', '04:30 PM'];

  useEffect(() => {
    if (schedules.length > 0 && !schedules.includes(selectedTime)) {
      setSelectedTime(schedules[0]);
    }
  }, [selectedBus?.id, selectedRoute?.id]);

  const currentSlotBookings = bookings.filter(
    (b) => Number(b.bus_id) === Number(selectedBus?.id) && b.schedule_time === selectedTime
  );
  const myBooking = currentSlotBookings.find((b) => Number(b.student_id) === Number(user?.id));
  const bookedSeatNumbers = currentSlotBookings.map((b) => Number(b.seat_number));
  const { cfg: activeSeatCfg, totalSeats } = computeBusCapacity(selectedBus?.seat_config);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

  const handleBookSeat = async (seatNum) => {
    if (!user || !selectedBus) return;
    if (myBooking) {
      showToast(`You already booked Seat #${myBooking.seat_number} for this trip. Cancel it first to switch.`);
      return;
    }

    // Zero-Trust Client + Server Gender Enforcement
    const femaleSet = new Set((activeSeatCfg.femaleSeats || []).map(Number));
    const maleSet = new Set((activeSeatCfg.maleSeats || []).map(Number));
    const userGender = String(user.gender || '').toLowerCase();

    if (femaleSet.has(Number(seatNum)) && userGender !== 'female') {
      await db.logAudit(user, 'GENDER_SEAT_BLOCKED', `Male student ${user.name} blocked from Female seat #${seatNum} on ${selectedBus.bus_number}.`);
      showToast(`🚫 Seat #${seatNum} is reserved exclusively for Female students!`);
      return;
    }
    if (maleSet.has(Number(seatNum)) && userGender !== 'male') {
      await db.logAudit(user, 'GENDER_SEAT_BLOCKED', `Female student ${user.name} blocked from Male seat #${seatNum} on ${selectedBus.bus_number}.`);
      showToast(`🚫 Seat #${seatNum} is reserved exclusively for Male students!`);
      return;
    }

    const { error } = await db.bookSeat({
      bus_id: selectedBus.id,
      route_id: selectedBus.route_id,
      schedule_time: selectedTime,
      seat_number: seatNum,
      booking_date: today,
    });
    if (error) {
      showToast(`⚠️ ${error}`);
      await loadData();
      return;
    }
    showToast(`✅ Confirmed! Seat #${seatNum} booked on ${selectedBus.bus_number}.`);
    await loadData();
  };

  const handleCancelSeat = async () => {
    if (!myBooking) return;
    const { error } = await db.cancelBooking(myBooking.id);
    if (error) { showToast(`⚠️ ${error}`); return; }
    showToast('Seat booking cancelled.');
    await loadData();
  };

  const handleTriggerSOS = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSosSending(true);
    await db.insert('sos_alerts', {
      reporter_id: user.id,
      reporter_name: user.name,
      reporter_role: 'student',
      reporter_phone: user.phone || 'N/A',
      reporter_dept: user.department || 'N/A',
      reporter_batch: user.batch || 'N/A',
      guardian_phone: user.guardian_phone || 'Not Provided',
      bus_id: selectedBus?.id || null,
      bus_number: selectedBus?.bus_number || 'General Campus',
      category: sanitizeText(sosCategory, 50),
      message: sanitizeText(sosMessage, 250) || 'Urgent assistance needed immediately!',
      lat: selectedBus?.current_lat || 23.8769,
      lng: selectedBus?.current_lng || 90.3202,
      status: 'active',
    });
    await db.logAudit(user, 'SOS_TRIGGERED', `Student ${user.name} sent SOS (${sosCategory}) on ${selectedBus?.bus_number}.`);
    setSosSending(false);
    setSosOpen(false);
    setSosMessage('');
    showToast('🚨 Emergency SOS Alert sent to Transport Controller & Admin with your live location & guardian contact!');
  };

  const handleLogout = () => {
    clearSession();
    router.replace('/');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pb-14 px-3 sm:px-6 pt-4">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <header className="glass-panel px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-sm">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">
                  {user.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                  {user.uni_id || 'Student'} • {user.department || 'DIU'} {user.batch ? `B-${user.batch}` : ''}
                </span>
                {user.gender && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    user.gender === 'female'
                      ? 'bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-500/40'
                      : 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40'
                  }`}>
                    {user.gender}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSosOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md shadow-rose-600/25 animate-pulse cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              SOS
            </button>
            <button onClick={loadData} className="glass-btn p-2 rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer" title="Refresh Live Data">
              <RefreshCw className="w-4 h-4" />
            </button>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="glass-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Live Notice */}
        {notices[0] && (
          <div className={`glass-card px-4 py-3 flex items-start gap-3 border-l-4 ${
            notices[0].priority === 'urgent' ? 'border-l-rose-500' : 'border-l-slate-600 dark:border-l-slate-300'
          }`}>
            <Megaphone className="w-4 h-4 mt-0.5 shrink-0 text-slate-700 dark:text-slate-200" />
            <div className="text-xs">
              <span className="font-extrabold text-slate-800 dark:text-white">{notices[0].title}: </span>
              <span className="text-slate-600 dark:text-slate-300">{notices[0].message}</span>
            </div>
          </div>
        )}

        {toast && (
          <div className="glass-panel px-4 py-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-white border-l-4 border-l-emerald-500">
            {toast}
          </div>
        )}

        {/* Step 1: Bus Selector */}
        <section className="glass-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <Bus className="w-4 h-4" /> 1. Select Bus & Schedule
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {schedules.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTime(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedTime === t
                      ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Clock className="w-3 h-3 inline mr-1" />{t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {buses.map((bus) => {
              const r = routes.find((rt) => Number(rt.id) === Number(bus.route_id));
              const active = Number(selectedBus?.id) === Number(bus.id);
              const { totalSeats: cap, cfg: bCfg } = computeBusCapacity(bus.seat_config);
              return (
                <button
                  key={bus.id}
                  onClick={() => setSelectedBusId(bus.id)}
                  className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer border ${
                    active
                      ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg'
                      : 'bg-white/55 dark:bg-slate-800/55 border-white/70 dark:border-white/10 text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm">{bus.bus_number}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${bus.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  </div>
                  <div className={`text-[11px] font-semibold mt-1 truncate ${active ? 'opacity-90' : 'text-slate-500 dark:text-slate-400'}`}>
                    {r?.name || 'Route Unassigned'}
                  </div>
                  <div className={`text-[10px] mt-1.5 flex items-center justify-between ${active ? 'opacity-80' : 'text-slate-400'}`}>
                    <span>{cap} Seats {bCfg.femaleSeats.length > 0 ? '• F-Zone' : ''}</span>
                    <span>{bus.status === 'active' ? `${bus.speed_kmh || 0} km/h` : 'Standby'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Map + Stoppages + Controller Hotline */}
          <div className="lg:col-span-7 space-y-5">
            <div className="glass-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    2. Live Location — {selectedBus?.bus_number || 'Select Bus'}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedRoute?.name || 'No Route'} • Driver: {assignedDriver?.name || 'Unassigned'} • Speed: {selectedBus?.speed_kmh || 0} km/h
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  selectedBus?.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                }`}>
                  {selectedBus?.status === 'active' ? '● Live Moving' : '● Standby'}
                </span>
              </div>

              <LiveBusMap
                buses={buses}
                routes={routes}
                selectedBusId={selectedBus?.id}
                height="320px"
              />

              {selectedRoute?.stoppages?.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Route Stoppages ({selectedRoute.stoppages.length})
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedRoute.stoppages.map((st, idx) => (
                      <div key={idx} className="glass-card px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-[9px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <span>{st.name}</span>
                        <span className="text-[10px] text-slate-400">+{st.offset_min || 0}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card p-4 sm:p-5">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <PhoneCall className="w-4 h-4" /> Transport Controller Support Hotline
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {controllers.map((c) => (
                  <div key={c.id} className="bg-white/55 dark:bg-slate-800/55 border border-white/70 dark:border-white/10 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.phone || 'Transport Control Room'}</div>
                    </div>
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="glass-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <PhoneCall className="w-3 h-3" /> Call
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                Guardian Emergency Contact: <b className="text-slate-700 dark:text-slate-200">{user.guardian_phone || 'Not Set'}</b>
              </div>
            </div>
          </div>

          {/* Right: Seat Booking + QR Boarding Pass */}
          <div className="lg:col-span-5 space-y-5">
            {myBooking && (
              <div className="glass-panel p-4 sm:p-5 border-2 border-emerald-500/40">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Live QR Boarding Pass</h3>
                      <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Live Clock: {nowClock}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelSeat}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/70 rounded-2xl p-3.5 flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-700">
                  <div className="space-y-1 text-xs">
                    <div className="font-extrabold text-slate-800 dark:text-white text-sm">
                      {selectedBus?.bus_number} • Seat #{myBooking.seat_number}
                    </div>
                    <div className="text-slate-600 dark:text-slate-300">{user.name} ({user.uni_id})</div>
                    <div className="text-[11px] text-slate-500">{selectedRoute?.name} • {selectedTime}</div>
                    <div className="text-[10px] font-mono text-slate-400">Token: {myBooking.qr_token}</div>
                  </div>
                  <div className="w-20 h-20 shrink-0 rounded-xl bg-slate-900 text-white p-2 flex flex-col items-center justify-center">
                    <QrCode className="w-12 h-12" />
                    <span className="text-[8px] font-mono mt-0.5">VERIFIED</span>
                  </div>
                </div>
              </div>
            )}

            <div className="glass-card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">
                    3. Seat Booking — {selectedBus?.bus_number}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Trip: {selectedTime} • Available: {Math.max(0, totalSeats - bookedSeatNumbers.length)}/{totalSeats}
                  </p>
                </div>
              </div>

              {selectedBus && (
                <BusSeatLayout
                  busNumber={selectedBus.bus_number}
                  seatConfig={selectedBus.seat_config}
                  bookedSeats={bookedSeatNumbers}
                  mySeat={myBooking?.seat_number || null}
                  studentGender={String(user.gender || '').toLowerCase()}
                  mode="book"
                  onSelectSeat={handleBookSeat}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SOS Modal */}
      {sosOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleTriggerSOS} className="glass-panel max-w-md w-full p-6 space-y-4 border-2 border-rose-500/50">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-6 h-6" />
              <div>
                <h3 className="text-base font-extrabold">Trigger Live Emergency SOS</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Immediately alerts DIU Transport Controller & Admin with Bus GPS & your Guardian Contact.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {['Security Issue', 'Road Accident', 'Medical Emergency', 'Bus Breakdown'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSosCategory(cat)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                    sosCategory === cat
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'glass-card text-slate-700 dark:text-slate-200'
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
              placeholder="Optional short note about the emergency..."
              className="glass-input w-full p-3 text-sm"
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSosOpen(false)}
                className="glass-btn px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sosSending}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer"
              >
                {sosSending ? 'Sending Alert...' : '🚨 Send Live SOS Now'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
