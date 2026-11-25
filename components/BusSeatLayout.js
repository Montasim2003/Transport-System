'use client';
import { DoorOpen, Cpu, Disc, UserCheck } from 'lucide-react';

export const DEFAULT_SEAT_CONFIG = {
  rows: 10,
  leftCols: 2,
  rightCols: 2,
  backBench: false,
  disabledSeats: [],
};

/**
 * Generates sequential seat numbers and total active capacity from a bus's seat_config.
 */
export function computeBusCapacity(rawConfig) {
  const cfg = { ...DEFAULT_SEAT_CONFIG, ...(rawConfig || {}) };
  const rows = Math.max(4, Math.min(15, Number(cfg.rows) || 10));
  const leftCols = Math.max(1, Math.min(3, Number(cfg.leftCols) || 2));
  const rightCols = Math.max(1, Math.min(3, Number(cfg.rightCols) || 2));
  const backBench = Boolean(cfg.backBench);
  const disabled = new Set((cfg.disabledSeats || []).map(Number));

  const gridRows = [];
  let counter = 1;
  for (let r = 0; r < rows; r++) {
    const left = [];
    for (let c = 0; c < leftCols; c++) left.push(counter++);
    const right = [];
    for (let c = 0; c < rightCols; c++) right.push(counter++);
    gridRows.push({ rowIndex: r + 1, left, right });
  }

  const backSeats = [];
  if (backBench) {
    const benchCount = leftCols + rightCols + 1;
    for (let b = 0; b < benchCount; b++) backSeats.push(counter++);
  }

  const maxSeatNumber = counter - 1;
  const activeSeats = maxSeatNumber - disabled.size;

  return { cfg: { rows, leftCols, rightCols, backBench, disabledSeats: [...disabled] }, gridRows, backSeats, totalSeats: activeSeats, maxSeatNumber };
}

/**
 * Realistic Bus Cabin Visualizer & Controller Layout Editor
 * - Main Entry Door (Left), Engine Hood (Center), and Driver Seat (Right) are ALWAYS FIXED.
 * - Passenger seats dynamically adapt to the Controller's custom configuration per bus.
 */
export default function BusSeatLayout({
  seatConfig,
  bookedSeats = [],
  mySeat = null,
  mode = 'book', // 'book' | 'edit' | 'preview'
  onSelectSeat,
  onToggleDisableSeat,
  busNumber = 'Bus-01',
}) {
  const { cfg, gridRows, backSeats, totalSeats } = computeBusCapacity(seatConfig);
  const bookedSet = new Set(bookedSeats.map(Number));
  const disabledSet = new Set(cfg.disabledSeats.map(Number));

  const renderSeatButton = (seatNum) => {
    const isDisabled = disabledSet.has(seatNum);
    const isMine = Number(mySeat) === seatNum;
    const isBooked = bookedSet.has(seatNum) && !isMine;

    if (mode === 'edit') {
      return (
        <button
          key={seatNum}
          type="button"
          onClick={() => onToggleDisableSeat && onToggleDisableSeat(seatNum)}
          title={isDisabled ? `Click to restore Seat #${seatNum}` : `Click to remove/block Seat #${seatNum}`}
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
            isDisabled
              ? 'border-dashed border-slate-400/50 bg-slate-200/20 dark:bg-slate-800/30 text-slate-400 line-through opacity-55 hover:opacity-100'
              : 'bg-white/75 dark:bg-slate-700/75 border-slate-300 dark:border-slate-500 text-slate-800 dark:text-slate-100 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 shadow-sm'
          }`}
        >
          <span>{seatNum}</span>
          {isDisabled && <span className="text-[8px] font-medium">OFF</span>}
        </button>
      );
    }

    if (isDisabled) {
      return (
        <div
          key={seatNum}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-dashed border-slate-300/40 dark:border-slate-700/40 flex items-center justify-center text-[9px] text-slate-400/60 select-none"
          title="Space / Unavailable"
        >
          —
        </div>
      );
    }

    let styleClass =
      'bg-white/70 dark:bg-slate-800/70 border-emerald-500/45 text-slate-800 dark:text-slate-100 hover:bg-emerald-500/15 hover:border-emerald-500 cursor-pointer';
    if (isMine) {
      styleClass =
        'bg-slate-800 dark:bg-slate-100 border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-md scale-105';
    } else if (isBooked) {
      styleClass =
        'bg-rose-500/20 dark:bg-rose-500/25 border-rose-500/50 text-rose-700 dark:text-rose-300 cursor-not-allowed opacity-85';
    }

    return (
      <button
        key={seatNum}
        type="button"
        disabled={mode !== 'book' || isBooked}
        onClick={() => mode === 'book' && !isBooked && onSelectSeat && onSelectSeat(seatNum)}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-xs font-bold border transition-all flex items-center justify-center ${styleClass}`}
      >
        {isMine ? <UserCheck className="w-4 h-4" /> : seatNum}
      </button>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs mb-4 text-slate-600 dark:text-slate-300">
        {mode === 'edit' ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-white/80 dark:bg-slate-700 border border-slate-400 inline-block" />
              Active Seat (Click to Disable)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border border-dashed border-slate-400 inline-block" />
              Removed / Space
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-white/80 dark:bg-slate-800 border border-emerald-500 inline-block" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-800 dark:bg-slate-100 inline-block" />
              Your Seat
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-500/30 border border-rose-500 inline-block" />
              Booked
            </span>
          </>
        )}
      </div>

      {/* Bus Chassis Outer Shell */}
      <div className="glass-card p-4 sm:p-5 rounded-[2rem] border-2 border-white/70 dark:border-white/15 relative overflow-hidden">
        {/* Windshield Curve Accent */}
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">
          {busNumber} • Front Windshield • {totalSeats} Passenger Seats
        </div>

        {/* ============================================================
            FIXED FRONT CABIN: Main Door (Left) | Engine (Center) | Driver (Right)
            Controller CANNOT remove these structural bus components.
           ============================================================ */}
        <div className="grid grid-cols-3 gap-2 pb-4 mb-4 border-b border-dashed border-slate-300/70 dark:border-slate-600/60">
          <div className="rounded-xl px-2 py-2.5 bg-sky-500/10 border border-sky-500/30 flex flex-col items-center justify-center text-sky-700 dark:text-sky-300">
            <DoorOpen className="w-4 h-4 mb-1" />
            <span className="text-[10px] font-bold uppercase">Main Door</span>
            <span className="text-[9px] opacity-70">Fixed</span>
          </div>

          <div className="rounded-xl px-2 py-2.5 bg-slate-500/12 border border-slate-400/35 flex flex-col items-center justify-center text-slate-700 dark:text-slate-300">
            <Cpu className="w-4 h-4 mb-1" />
            <span className="text-[10px] font-bold uppercase">Engine Bay</span>
            <span className="text-[9px] opacity-70">Fixed</span>
          </div>

          <div className="rounded-xl px-2 py-2.5 bg-slate-800/85 dark:bg-slate-200/90 text-white dark:text-slate-900 flex flex-col items-center justify-center shadow-sm">
            <Disc className="w-4 h-4 mb-1" />
            <span className="text-[10px] font-bold uppercase">Driver Seat</span>
            <span className="text-[9px] opacity-75">Fixed</span>
          </div>
        </div>

        {/* ============================================================
            EDITABLE PASSENGER CABIN (Controlled per bus by Controller)
           ============================================================ */}
        <div className="space-y-2.5">
          {gridRows.map((row) => (
            <div key={row.rowIndex} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {row.left.map((s) => renderSeatButton(s))}
              </div>

              <div className="text-[9px] font-semibold text-slate-400/60 select-none px-1">
                R{row.rowIndex}
              </div>

              <div className="flex items-center gap-1.5">
                {row.right.map((s) => renderSeatButton(s))}
              </div>
            </div>
          ))}

          {/* Optional Back Bench Row */}
          {backSeats.length > 0 && (
            <div className="pt-2.5 mt-2.5 border-t border-dashed border-slate-300/60 dark:border-slate-700/60">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {backSeats.map((s) => renderSeatButton(s))}
              </div>
              <div className="text-center text-[9px] uppercase tracking-wider text-slate-400 mt-1.5">
                Rear Bench Row
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
