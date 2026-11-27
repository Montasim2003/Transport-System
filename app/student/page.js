'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bus, MapPin, Clock, LogOut, PhoneCall, AlertTriangle, QrCode,
  Trash2, ShieldAlert, Megaphone, RefreshCw, Bell, BellRing, BellOff,
  Lock, Navigation, CheckCircle2, Sparkles
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LiveBusMap from '@/components/LiveBusMap';
import BusSeatLayout, { computeBusCapacity } from '@/components/BusSeatLayout';
import { db } from '@/lib/supabase';
import { getVerifiedSession, clearSession, getDashboardPath } from '@/lib/auth';
import { sanitizeText } from '@/lib/security';
import {
  getDhakaClock,
  evaluateBusBookingWindow,
  getAllCityStoppages,
  busServesStoppage,
  formatHHMMTo12h,
} from '@/lib/schedule';

function playGentleChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {}
}

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
  const [selectedTime, setSelectedTime] = useState('02:20 PM');
  const [toast, setToast] = useState('');
  const [tick, setTick] = useState(0); // 1-second reactive clock tick for countdown & auto-unlock
  const [nowClock, setNowClock] = useState('');

  // Student Preferred Area / Stoppage & Targeted Phone Notifications
  const [preferredStoppage, setPreferredStoppage] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [notifPermission, setNotifPermission] = useState('default');
  const [savingArea, setSavingArea] = useState(false);
  const [liveBookingAlert, setLiveBookingAlert] = useState(null); // In-app alert banner for targeted bus

  // SOS Modal
  const [sosOpen, setSosOpen] = useState(false);
  const [sosCategory, setSosCategory] = useState('Security Issue');
  const [sosMessage, setSosMessage] = useState('');
  const [sosSending, setSosSending] = useState(false);

  const alertedKeysRef = useRef(new Set());
  const today = new Date().toISOString().slice(0, 10);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

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

      // Restore student's saved stoppage & notification preference
      const savedStop = session.preferred_stoppage || localStorage.getItem('diu_pref_stoppage_v42') || '';
      setPreferredStoppage(savedStop);
      setAlertsEnabled(session.notifications_enabled !== false);

      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotifPermission(Notification.permission);
      }

      loadData();

      poll = setInterval(loadData, 4000);
      clock = setInterval(() => {
        setNowClock(getDhakaClock().formatted12h);
        setTick((t) => t + 1);
      }, 1000);
      setNowClock(getDhakaClock().formatted12h);
    })();

    return () => {
      active = false;
      if (poll) clearInterval(poll);
      if (clock) clearInterval(clock);
    };
  }, [router, loadData]);

  const allStoppages = useMemo(() => getAllCityStoppages(routes), [routes]);

  // Buses that specifically pass through the student's selected area/stoppage
  const myAreaBuses = useMemo(() => {
    if (!preferredStoppage) return [];
    return buses.filter((b) => busServesStoppage(b, routes, preferredStoppage));
  }, [buses, routes, preferredStoppage]);

  // Helper to send Native Phone Notification + Vibration + In-App Banner
  const dispatchTargetedPhoneAlert = useCallback((bus, win, isTest = false) => {
    const title = isTest
      ? `🔔 Test Alert: DIU Transport (${preferredStoppage || 'Your Area'})`
      : `🚌 ${bus.bus_number} Seat Booking Open!`;
    const body = isTest
      ? `Phone alerts are active! You will ONLY be notified when a bus for ${preferredStoppage || 'your area'} opens booking 20 mins before campus departure.`
      : `${bus.bus_number} leaves DIU Campus at ${win.departure12h} for ${preferredStoppage}. Book your seat now!`;

    if (typeof window !== 'undefined') {
      if ('vibrate' in navigator) {
        try { navigator.vibrate([220, 100, 220]); } catch {}
      }
      playGentleChime();
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            tag: isTest ? 'diu-test' : `diu-bus-${bus.id}-${bus.departure_time}`,
            renotify: true,
          });
        } catch {}
      }
    }

    setLiveBookingAlert({
      busId: bus?.id || null,
      busNumber: bus?.bus_number || 'DIU Bus',
      departure12h: win?.departure12h || '',
      title,
      body,
      isTest,
    });
  }, [preferredStoppage]);

  // TARGETED NOTIFICATION WATCHER:
  // Monitors ONLY buses passing `preferredStoppage` that are leaving DIU Campus (`from_campus`).
  // The exact moment the 20-minute window opens, alerts the student's phone ONCE!
  useEffect(() => {
    if (!alertsEnabled || !preferredStoppage || myAreaBuses.length === 0) return;

    for (const bus of myAreaBuses) {
      if ((bus.trip_direction || 'from_campus') !== 'from_campus') continue;
      const win = evaluateBusBookingWindow(bus);
      if (win.state !== 'open_now') continue;

      const dedupeKey = `diu_alerted_${today}_${bus.id}_${bus.departure_time || 'def'}`;
      if (alertedKeysRef.current.has(dedupeKey)) continue;
      try {
        if (localStorage.getItem(dedupeKey) === '1') {
          alertedKeysRef.current.add(dedupeKey);
          continue;
        }
        localStorage.setItem(dedupeKey, '1');
      } catch {}
      alertedKeysRef.current.add(dedupeKey);

      dispatchTargetedPhoneAlert(bus, win, false);
      break;
    }
  }, [tick, alertsEnabled, preferredStoppage, myAreaBuses, today, dispatchTargetedPhoneAlert]);

  const handleSaveAreaPreference = async (newStoppage, nextAlertsEnabled = alertsEnabled) => {
    setPreferredStoppage(newStoppage);
    setAlertsEnabled(nextAlertsEnabled);
    try { localStorage.setItem('diu_pref_stoppage_v42', newStoppage); } catch {}

    setSavingArea(true);
    const { user: updatedUser, error } = await db.updateStudentPreferences({
      preferred_stoppage: newStoppage,
      notifications_enabled: nextAlertsEnabled,
    });
    setSavingArea(false);

    if (updatedUser) setUser(updatedUser);
    if (error) {
      showToast(`⚠️ Saved locally (${error})`);
    } else if (newStoppage) {
      showToast(`📍 Saved "${newStoppage}"! You will ONLY get alerts for buses passing ${newStoppage}.`);
      // Auto-select first bus serving their chosen area for instant convenience
      const firstMatch = buses.find((b) => busServesStoppage(b, routes, newStoppage));
      if (firstMatch) setSelectedBusId(firstMatch.id);
    }
  };

  const handleEnablePhoneNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      await handleSaveAreaPreference(preferredStoppage, !alertsEnabled);
      showToast('In-app sound & vibration alerts updated for your area.');
      return;
    }

    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        await handleSaveAreaPreference(preferredStoppage, true);
        showToast(`🔔 Phone notifications enabled for ${preferredStoppage || 'your selected area'}!`);
      } else {
        showToast('Browser notification permission blocked — in-app alert banner will still notify you.');
      }
      return;
    }

    const next = !alertsEnabled;
    await handleSaveAreaPreference(preferredStoppage, next);
    showToast(next ? `🔔 Alerts ON for ${preferredStoppage || 'your area'}` : '🔕 Booking alerts paused.');
  };

  const selectedBus = buses.find((b) => Number(b.id) === Number(selectedBusId)) || buses[0] || null;
  const selectedRoute = selectedBus
    ? routes.find((r) => Number(r.id) === Number(selectedBus.route_id))
    : null;
  const assignedDriver = selectedBus
    ? drivers.find((d) => Number(d.id) === Number(selectedBus.driver_id))
    : null;

  // Re-evaluate 20-min booking window every second for live countdown & auto-unlock
  const bookingWindow = useMemo(
    () => evaluateBusBookingWindow(selectedBus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedBus, tick]
  );

  const schedules = Array.isArray(selectedRoute?.schedules) && selectedRoute.schedules.length > 0
    ? selectedRoute.schedules
    : ['07:30 AM', '02:20 PM', '04:30 PM'];

  // For `from_campus` buses, bind active trip slot to the Controller's fixed departure time
  const activeScheduleSlot =
    bookingWindow.isCampusDeparture && selectedBus?.departure_time
      ? formatHHMMTo12h(selectedBus.departure_time)
      : selectedTime;

  useEffect(() => {
    if (!bookingWindow.isCampusDeparture && schedules.length > 0 && !schedules.includes(selectedTime)) {
      setSelectedTime(schedules[0]);
    }
  }, [selectedBus?.id, selectedRoute?.id, bookingWindow.isCampusDeparture]);

  const currentSlotBookings = bookings.filter(
    (b) => Number(b.bus_id) === Number(selectedBus?.id) && b.schedule_time === activeScheduleSlot
  );
  const myBooking = currentSlotBookings.find((b) => Number(b.student_id) === Number(user?.id));
  const bookedSeatNumbers = currentSlotBookings.map((b) => Number(b.seat_number));
  const { cfg: activeSeatCfg, totalSeats } = computeBusCapacity(selectedBus?.seat_config);

  const handleBookSeat = async (seatNum) => {
    if (!user || !selectedBus) return;
    if (myBooking) {
      showToast(`You already booked Seat #${myBooking.seat_number} for this trip. Cancel it first to switch.`);
      return;
    }

    if (!bookingWindow.canBook) {
      showToast(`🔒 ${bookingWindow.detail}`);
      return;
    }

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
      schedule_time: activeScheduleSlot,
      seat_number: seatNum,
      booking_date: today,
    });
    if (error) {
      showToast(`⚠️ ${error}`);
      await loadData();
      return;
    }
    showToast(`✅ Confirmed! Seat #${seatNum} booked on ${selectedBus.bus_number} (${activeScheduleSlot}).`);
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user.email} • BD Time: <span className="font-mono font-bold">{nowClock}</span>
              </p>
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

        {/* TARGETED LIVE BOOKING OPEN PHONE ALERT BANNER */}
        {liveBookingAlert && (
          <div className="rounded-2xl bg-emerald-600 text-white p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 border-2 border-emerald-300">
            <div className="flex items-start gap-3">
              <BellRing className="w-6 h-6 shrink-0 animate-bounce mt-0.5" />
              <div className="text-xs space-y-0.5">
                <div className="font-extrabold text-sm">{liveBookingAlert.title}</div>
                <div className="opacity-95">{liveBookingAlert.body}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {liveBookingAlert.busId && (
                <button
                  onClick={() => {
                    setSelectedBusId(liveBookingAlert.busId);
                    setLiveBookingAlert(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white text-emerald-700 text-xs font-extrabold cursor-pointer"
                >
                  Book Seat Now
                </button>
              )}
              <button
                onClick={() => setLiveBookingAlert(null)}
                className="px-3 py-2 rounded-xl bg-emerald-800/70 text-white text-xs font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

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

        {/* NEW SECTION: MY AREA / STOPPAGE & TARGETED BUS ALERTS */}
        <section className="glass-panel p-4 sm:p-5 space-y-3.5 border border-white/80 dark:border-white/15">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                My Stoppage & Targeted Bus Notifications
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Select your area once. See which bus passes your stoppage and receive phone notifications ONLY when your bus&apos;s 20-minute campus departure booking opens.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={preferredStoppage}
                disabled={savingArea}
                onChange={(e) => handleSaveAreaPreference(e.target.value, alertsEnabled)}
                className="glass-input px-3 py-2 text-xs font-bold min-w-[190px]"
              >
                <option value="">-- Select Your Area / Stoppage --</option>
                {allStoppages.map((stop) => (
                  <option key={stop} value={stop}>{stop}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleEnablePhoneNotifications}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
                  alertsEnabled
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'glass-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                {alertsEnabled ? <BellRing className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                {alertsEnabled
                  ? notifPermission === 'granted' ? 'Phone Alerts ON' : 'Enable Phone Alert'
                  : 'Alerts Paused'}
              </button>

              {preferredStoppage && (
                <button
                  type="button"
                  onClick={() => dispatchTargetedPhoneAlert(myAreaBuses[0] || selectedBus, { departure12h: '03:00 PM' }, true)}
                  className="glass-btn px-3 py-2 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1"
                  title="Send a test alert to your phone"
                >
                  <Bell className="w-3.5 h-3.5" /> Test Alert
                </button>
              )}
            </div>
          </div>

          {preferredStoppage ? (
            <div className="pt-2 border-t border-slate-300/40 dark:border-slate-700/50">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Buses Passing <b className="text-slate-800 dark:text-white">{preferredStoppage}</b> ({myAreaBuses.length} Found — Only These Buses Will Notify You):
              </div>

              {myAreaBuses.length === 0 ? (
                <div className="text-xs text-slate-500">No buses currently assigned to {preferredStoppage}.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {myAreaBuses.map((b) => {
                    const rt = routes.find((r) => Number(r.id) === Number(b.route_id));
                    const w = evaluateBusBookingWindow(b);
                    const isSelected = Number(selectedBus?.id) === Number(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBusId(b.id)}
                        className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-800'
                            : 'bg-white/65 dark:bg-slate-800/65 border-white/80 dark:border-white/10 hover:bg-white/90'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold flex items-center gap-1.5">
                            <span>🚌 {b.bus_number}</span>
                            <span className={`w-2 h-2 rounded-full ${b.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                          </div>
                          <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'opacity-85' : 'text-slate-500'}`}>
                            {rt?.name} • {b.status === 'active' ? `${b.speed_kmh || 0} km/h` : 'Standby'}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                          !w.isCampusDeparture
                            ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                            : w.state === 'open_now'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                        }`}>
                          {!w.isCampusDeparture
                            ? 'To DIU • Track'
                            : w.state === 'open_now'
                            ? 'Booking OPEN'
                            : w.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3.5 py-2">
              👆 Choose your area/stoppage above to filter which bus numbers pass near you and enable automatic phone alerts when booking opens!
            </div>
          )}
        </section>

        {/* Step 1: All Fleet Bus Selector */}
        <section className="glass-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <Bus className="w-4 h-4" /> 1. All University Buses & Schedule
            </h2>
            {!bookingWindow.isCampusDeparture ? (
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
            ) : (
              <span className="px-3 py-1 rounded-lg text-xs font-extrabold bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900">
                <Clock className="w-3 h-3 inline mr-1" />
                Fixed Campus Departure: {bookingWindow.departure12h}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {buses.map((bus) => {
              const r = routes.find((rt) => Number(rt.id) === Number(bus.route_id));
              const active = Number(selectedBus?.id) === Number(bus.id);
              const { totalSeats: cap, cfg: bCfg } = computeBusCapacity(bus.seat_config);
              const bw = evaluateBusBookingWindow(bus);
              const matchesArea = preferredStoppage && busServesStoppage(bus, routes, preferredStoppage);

              return (
                <button
                  key={bus.id}
                  onClick={() => setSelectedBusId(bus.id)}
                  className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer border relative ${
                    active
                      ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg'
                      : 'bg-white/55 dark:bg-slate-800/55 border-white/70 dark:border-white/10 text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-sm flex items-center gap-1">
                      {bus.bus_number}
                      {matchesArea && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-white font-extrabold">
                          YOUR AREA
                        </span>
                      )}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${bus.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  </div>
                  <div className={`text-[11px] font-semibold mt-1 truncate ${active ? 'opacity-90' : 'text-slate-500 dark:text-slate-400'}`}>
                    {r?.name || 'Route Unassigned'}
                  </div>
                  <div className={`text-[10px] mt-1.5 flex items-center justify-between ${active ? 'opacity-85' : 'text-slate-400'}`}>
                    <span>{cap} Seats {bCfg.femaleSeats.length > 0 ? '• F-Zone' : ''}</span>
                    <span className="font-bold">
                      {bw.isCampusDeparture ? `Dep ${bw.departure12h}` : 'To DIU'}
                    </span>
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
                    {selectedRoute.stoppages.map((st, idx) => {
                      const isMine = preferredStoppage && st.name?.toLowerCase() === preferredStoppage.toLowerCase();
                      return (
                        <div
                          key={idx}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border ${
                            isMine
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-extrabold'
                              : 'glass-card text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-[9px] flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span>{st.name}</span>
                          <span className="text-[10px] opacity-70">+{st.offset_min || 0}m</span>
                        </div>
                      );
                    })}
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

          {/* Right: 20-Min Window Status + Seat Booking + QR Boarding Pass */}
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
                    <div className="text-[11px] text-slate-500">{selectedRoute?.name} • {activeScheduleSlot}</div>
                    <div className="text-[10px] font-mono text-slate-400">Token: {myBooking.qr_token}</div>
                  </div>
                  <div className="w-20 h-20 shrink-0 rounded-xl bg-slate-900 text-white p-2 flex flex-col items-center justify-center">
                    <QrCode className="w-12 h-12" />
                    <span className="text-[8px] font-mono mt-0.5">VERIFIED</span>
                  </div>
                </div>
              </div>
            )}

            <div className="glass-card p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">
                    3. Seat Booking — {selectedBus?.bus_number}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Trip: {activeScheduleSlot} • Available: {Math.max(0, totalSeats - bookedSeatNumbers.length)}/{totalSeats}
                  </p>
                </div>
              </div>

              {/* 20-MINUTE CAMPUS DEPARTURE WINDOW STATUS BANNER */}
              {bookingWindow.isCampusDeparture ? (
                <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                  bookingWindow.state === 'open_now'
                    ? 'bg-emerald-500/12 border-emerald-500/45 text-emerald-800 dark:text-emerald-200'
                    : bookingWindow.state === 'locked_before'
                    ? 'bg-amber-500/12 border-amber-500/45 text-amber-900 dark:text-amber-200'
                    : 'bg-slate-500/12 border-slate-400/40 text-slate-700 dark:text-slate-300'
                }`}>
                  <div className="font-extrabold flex items-center gap-1.5">
                    {bookingWindow.state === 'open_now' ? (
                      <Sparkles className="w-4 h-4 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 shrink-0" />
                    )}
                    <span>{bookingWindow.label}</span>
                  </div>
                  <div className="text-[11px] opacity-90">{bookingWindow.detail}</div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/35 text-sky-800 dark:text-sky-200 text-xs">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5" /> Coming to DIU Campus (Live Tracking Mode)
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5">
                    20-minute departure lock applies only when buses depart DIU Campus. Track live bus location above.
                  </div>
                </div>
              )}

              {selectedBus && (
                <BusSeatLayout
                  busNumber={selectedBus.bus_number}
                  seatConfig={selectedBus.seat_config}
                  bookedSeats={bookedSeatNumbers}
                  mySeat={myBooking?.seat_number || null}
                  studentGender={String(user.gender || '').toLowerCase()}
                  bookingLocked={!bookingWindow.canBook}
                  lockMessage={bookingWindow.detail}
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
