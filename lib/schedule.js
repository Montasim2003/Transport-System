/**
 * ============================================================================
 * DIU SMART TRANSPORT v4.2 — CAMPUS DEPARTURE 20-MIN WINDOW & AREA ENGINE
 * ============================================================================
 * - Calculates exact Bangladesh Standard Time (Asia/Dhaka) seconds-of-day.
 * - Enforces 20-minute pre-departure booking window ONLY for `from_campus` trips.
 * - Keeps `to_campus` trips open for live bus tracking near student stoppages.
 * - Matches buses passing a student's saved stoppage for targeted notifications.
 * ============================================================================
 */

export function getDhakaClock() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const second = Number(parts.find((p) => p.type === 'second')?.value || 0);
  const totalSeconds = hour * 3600 + minute * 60 + second;

  return {
    hour,
    minute,
    second,
    totalSeconds,
    formatted12h: now.toLocaleTimeString('en-BD', {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }),
  };
}

export function formatHHMMTo12h(hhmm) {
  if (!hhmm || !String(hhmm).includes(':')) return 'Not Set';
  const [hRaw, mRaw] = String(hhmm).split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(hhmm);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function offsetDhakaHHMM(offsetMinutes) {
  const { totalSeconds } = getDhakaClock();
  const targetMins = (Math.floor(totalSeconds / 60) + offsetMinutes + 1440) % 1440;
  const hh = Math.floor(targetMins / 60);
  const mm = targetMins % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

/**
 * Computes exact booking window state for a bus in Asia/Dhaka time.
 * ONLY applies 20-minute lock when `trip_direction === 'from_campus'`.
 */
export function evaluateBusBookingWindow(bus) {
  if (!bus) {
    return {
      isCampusDeparture: false,
      state: 'open_always',
      canBook: true,
      label: 'Select a Bus',
      detail: '',
    };
  }

  const direction = bus.trip_direction || 'from_campus';
  if (direction !== 'from_campus') {
    return {
      isCampusDeparture: false,
      state: 'to_campus_tracking',
      canBook: true,
      departure12h: bus.departure_time ? formatHHMMTo12h(bus.departure_time) : null,
      open12h: null,
      label: 'Coming to DIU Campus (Live Tracking)',
      detail: 'Track live GPS location as this bus approaches your stoppage.',
    };
  }

  const depStr = bus.departure_time || '14:20';
  const windowMins = Math.max(5, Math.min(60, Number(bus.booking_window_mins) || 20));
  const [dh, dm] = depStr.split(':').map(Number);

  if (Number.isNaN(dh) || Number.isNaN(dm)) {
    return {
      isCampusDeparture: true,
      state: 'open_now',
      canBook: true,
      departure12h: depStr,
      open12h: null,
      label: 'Booking Open',
      detail: '',
    };
  }

  const depSec = dh * 3600 + dm * 60;
  const openSec = Math.max(0, depSec - windowMins * 60);
  const openHH = Math.floor(openSec / 3600);
  const openMM = Math.floor((openSec % 3600) / 60);
  const openHHMM = `${String(openHH).padStart(2, '0')}:${String(openMM).padStart(2, '0')}`;

  const departure12h = formatHHMMTo12h(depStr);
  const open12h = formatHHMMTo12h(openHHMM);

  const { totalSeconds: nowSec } = getDhakaClock();

  if (nowSec < openSec) {
    const waitSec = openSec - nowSec;
    return {
      isCampusDeparture: true,
      state: 'locked_before',
      canBook: false,
      windowMins,
      departure12h,
      open12h,
      remainingSeconds: waitSec,
      label: `Opens at ${open12h}`,
      detail: `Booking opens ${windowMins} mins before ${departure12h} departure (in ${formatCountdown(waitSec)}).`,
    };
  }

  if (nowSec <= depSec) {
    const leftSec = depSec - nowSec;
    return {
      isCampusDeparture: true,
      state: 'open_now',
      canBook: true,
      windowMins,
      departure12h,
      open12h,
      remainingSeconds: leftSec,
      label: `Booking OPEN (${formatCountdown(leftSec)} left)`,
      detail: `Leaving DIU Campus at ${departure12h}. Book your seat before departure!`,
    };
  }

  return {
    isCampusDeparture: true,
    state: 'departed',
    canBook: false,
    windowMins,
    departure12h,
    open12h,
    remainingSeconds: 0,
    label: `Departed at ${departure12h}`,
    detail: `This campus departure (${departure12h}) has ended. Wait for Controller to set the next departure time.`,
  };
}

/**
 * Extracts a clean sorted list of all city stoppages across all routes
 * so students can select their exact home/boarding area.
 */
export function getAllCityStoppages(routes = []) {
  const seen = new Map();
  for (const r of routes) {
    const stops = Array.isArray(r.stoppages) ? r.stoppages : [];
    for (const st of stops) {
      const name = String(st?.name || '').trim();
      if (!name) continue;
      if (name.toLowerCase().includes('diu smart city')) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
  }
  return [...seen.values()];
}

/**
 * Returns true if a given bus's route passes through the student's selected area/stoppage.
 */
export function busServesStoppage(bus, routes = [], stoppageName = '') {
  const target = String(stoppageName || '').trim().toLowerCase();
  if (!target || !bus) return false;
  const route = routes.find((r) => Number(r.id) === Number(bus.route_id));
  if (!route) return false;

  const stops = Array.isArray(route.stoppages) ? route.stoppages : [];
  if (stops.some((s) => String(s?.name || '').trim().toLowerCase() === target)) {
    return true;
  }
  return String(route.name || '').toLowerCase().includes(target);
}
