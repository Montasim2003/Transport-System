'use client';
import { DoorOpen, Cpu, Disc, UserCheck, Lock } from 'lucide-react';

export const DEFAULT_SEAT_CONFIG = {
  rows: 10,
  leftCols: 2,
  rightCols: 2,
  backBench: false,
  disabledSeats: [],
  femaleSeats: [], // Empty by default -> All seats remain White unless Controller assigns!
  maleSeats: [],
};

export function computeBusCapacity(rawConfig) {
  const cfg = { ...DEFAULT_SEAT_CONFIG, ...(rawConfig || {}) };
  const rows = Math.max(4, Math.min(15, Number(cfg.rows) || 10));
  const leftCols = Math.max(1, Math.min(3, Number(cfg.leftCols) || 2));
  const rightCols = Math.max(1, Math.min(3, Number(cfg.rightCols) || 2));
  const backBench = Boolean(cfg.backBench);
  const disabled = new Set((cfg.disabledSeats || []).map(Number));
  const femaleSeats = (cfg.femaleSeats || []).map(Number).filter((n) => !disabled.has(n));
  const maleSeats = (cfg.maleSeats || []).map(Number).filter((n) => !disabled.has(n));

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

  return {
    cfg: {
      rows,
      leftCols,
      rightCols,
      backBench,
      disabledSeats: [...disabled],
      femaleSeats,
      maleSeats,
    },
    gridRows,
    backSeats,
    totalSeats: activeSeats,
    maxSeatNumber,
  };
}

/**
 * Realistic Bus Cabin Visualizer & Gender-Aware Seat Controller
 * - Default unrestricted seats stay crisp WHITE (`bg-white/85`).
 * - Female-reserved seats turn distinct PINK (`bg-pink-500/25 border-pink-500`) and lock out Male students.
 * - Male-reserved seats turn SKY BLUE (`bg-sky-500/25 border-sky-500`) and lock out Female students.
 */
export default function BusSeatLayout({
  seatConfig,
  bookedSeats = [],
  mySeat = null,
  studentGender = null, // 'male' | 'female' | null
  mode = 'book',        // 'book' | 'edit' | 'preview'
  onSelectSeat,
  onEditSeatClick,
  busNumber = 'Bus-01',
}) {
  const { cfg, gridRows, backSeats, totalSeats } = computeBusCapacity(seatConfig);
  const bookedSet = new Set(bookedSeats.map(Number));
  const disabledSet = new Set(cfg.disabledSeats.map(Number));
  const femaleSet = new Set(cfg.femaleSeats.map(Number));
  const maleSet = new Set(cfg.maleSeats.map(Number));

  const hasGenderZones = femaleSet.size > 0 || maleSet.size > 0;

  const renderSeatButton = (seatNum) => {
    const isDisabled = disabledSet.has(seatNum);
    const isFemale = femaleSet.has(seatNum);
    const isMale = maleSet.has(seatNum);
    const isMine = Number(mySeat) === seatNum;
    const isBooked = bookedSet.has(seatNum) && !isMine;

    // CONTROLLER EDIT MODE
    if (mode === 'edit') {
      let editStyle =
        'bg-white/90 dark:bg-slate-700/80 border-slate-300 dark:border-slate-500 text-slate-800 dark:text-slate-100';
      let badge = null;

      if (isDisabled) {
        editStyle =
          'border-dashed border-slate-400/50 bg-slate-200/20 dark:bg-slate-800/30 text-slate-400 line-through opacity-55';
        badge = 'OFF';
      } else if (isFemale) {
        editStyle =
          'bg-pink-500/25 dark:bg-pink-500/30 border-pink-500 text-pink-800 dark:text-pink-200 shadow-sm';
        badge = 'F';
      } else if (isMale) {
        editStyle =
          'bg-sky-500/25 dark:bg-sky-500/30 border-sky-500 text-sky-800 dark:text-sky-200 shadow-sm';
        badge = 'M';
      }

      return (
        <button
          key={seatNum}
          type="button"
          onClick={() => onEditSeatClick && onEditSeatClick(seatNum)}
          title={`Click to apply selected seat tool to Seat #${seatNum}`}
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center leading-none ${editStyle}`}
        >
          <span>{seatNum}</span>
          {badge && <span className="text-[8px] font-extrabold mt-0.5">{badge}</span>}
        </button>
      );
    }

    // STUDENT BOOKING MODE
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

    const blockedByGender =
      mode === 'book' &&
      ((isFemale && studentGender !== 'female') || (isMale && studentGender !== 'male'));

    // Default: Crisp White Seat (when Controller has NOT assigned any gender restriction)
    let styleClass =
      'bg-white/90 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:border-emerald-500 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 cursor-pointer shadow-xs';
    let subTag = null;
    let tooltip = `Seat #${seatNum} (General / Available)`;

    if (isFemale) {
      styleClass = blockedByGender
        ? 'bg-pink-500/22 dark:bg-pink-500/25 border-pink-500/70 text-pink-800 dark:text-pink-200 cursor-not-allowed opacity-85'
        : 'bg-pink-500/25 dark:bg-pink-500/30 border-pink-500 text-pink-900 dark:text-pink-100 hover:bg-pink-500/35 cursor-pointer shadow-xs';
      subTag = 'F';
      tooltip = blockedByGender
        ? `Seat #${seatNum} is reserved for Female students only`
        : `Seat #${seatNum} (Female Reserved — Available)`;
    } else if (isMale) {
      styleClass = blockedByGender
        ? 'bg-sky-500/22 dark:bg-sky-500/25 border-sky-500/70 text-sky-800 dark:text-sky-200 cursor-not-allowed opacity-85'
        : 'bg-sky-500/25 dark:bg-sky-500/30 border-sky-500 text-sky-900 dark:text-sky-100 hover:bg-sky-500/35 cursor-pointer shadow-xs';
      subTag = 'M';
      tooltip = blockedByGender
        ? `Seat #${seatNum} is reserved for Male students only`
        : `Seat #${seatNum} (Male Reserved — Available)`;
    }

    if (isMine) {
      styleClass =
        'bg-slate-800 dark:bg-slate-100 border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-md scale-105';
      tooltip = `Your Booked Seat (#${seatNum})`;
    } else if (isBooked) {
      styleClass =
        'bg-rose-600/25 dark:bg-rose-600/30 border-rose-600/60 text-rose-800 dark:text-rose-200 cursor-not-allowed opacity-85';
      subTag = null;
      tooltip = `Seat #${seatNum} is already booked`;
    }

    return (
      <button
        key={seatNum}
        type="button"
        disabled={mode !== 'book' || isBooked || blockedByGender}
        onClick={() => mode === 'book' && !isBooked && !blockedByGender && onSelectSeat && onSelectSeat(seatNum)}
        title={tooltip}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center leading-none ${styleClass}`}
      >
        {isMine ? (
          <UserCheck className="w-4 h-4" />
        ) : blockedByGender && !isBooked ? (
          <>
            <span className="text-[11px]">{seatNum}</span>
            <span className="text-[8px] font-extrabold flex items-center gap-0.5 mt-0.5">
              <Lock className="w-2 h-2" />{subTag}
            </span>
          </>
        ) : (
          <>
            <span>{seatNum}</span>
            {subTag && <span className="text-[8px] font-extrabold mt-0.5">{subTag}</span>}
          </>
        )}
      </button>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Dynamic Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] mb-4 text-slate-600 dark:text-slate-300">
        {mode === 'edit' ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-white border border-slate-400 inline-block" />
              White (General)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-pink-500/30 border border-pink-500 inline-block" />
              Female (F)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-sky-500/30 border border-sky-500 inline-block" />
              Male (M)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border border-dashed border-slate-400 inline-block" />
              Removed
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-white border border-slate-400 inline-block" />
              Available
            </span>
            {femaleSet.size > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-pink-500/30 border border-pink-500 inline-block" />
                Female Only
              </span>
            )}
            {maleSet.size > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-sky-500/30 border border-sky-500 inline-block" />
                Male Only
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-800 dark:bg-slate-100 inline-block" />
              Your Seat
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-600/30 border border-rose-600 inline-block" />
              Booked
            </span>
          </>
        )}
      </div>

      {/* Bus Chassis Outer Shell */}
      <div className="glass-card p-4 sm:p-5 rounded-[2rem] border-2 border-white/70 dark:border-white/15 relative overflow-hidden">
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">
          {busNumber} • {totalSeats} Seats {hasGenderZones ? '• Gender Zones Active' : '• Open Seating'}
        </div>

        {/* FIXED FRONT CABIN: Main Door | Engine | Driver */}
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

        {/* PASSENGER CABIN */}
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
