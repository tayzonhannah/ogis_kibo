'use client';

import { useEffect, useState } from 'react';
import {
  CONNECT_MOMENT_CATEGORIES,
  CONNECT_MOMENT_CATEGORY_CONFIG,
  type ConnectMomentCategory,
} from '@/lib/constants';

interface ConnectMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSession: (
    category: ConnectMomentCategory,
    durationMinutes: number,
    multiplier: number
  ) => void;
  initiatorName?: string;
}

const DURATION_PRESETS = [5, 15, 25, 30, 45, 60];

export default function ConnectMomentModal({
  isOpen,
  onClose,
  onStartSession,
}: ConnectMomentModalProps) {
  const [selectedCategory, setSelectedCategory] =
    useState<ConnectMomentCategory>('study');
  const [duration, setDuration] = useState<number>(25);
  const [customMultiplier, setCustomMultiplier] = useState<number | null>(null);

  const categoryConfig = CONNECT_MOMENT_CATEGORY_CONFIG[selectedCategory];
  const activeMultiplier = Math.min(
    Math.max(customMultiplier ?? categoryConfig.multiplier, 1.0),
    5.0
  );

  const handlePickCategory = (cat: ConnectMomentCategory) => {
    setSelectedCategory(cat);
    const cfg = CONNECT_MOMENT_CATEGORY_CONFIG[cat];
    if (cfg) {
      setDuration(cfg.defaultMinutes);
      setCustomMultiplier(cfg.multiplier);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const estimatedPoints = Math.round(duration * activeMultiplier * 2);

  const handleStart = () => {
    onStartSession(selectedCategory, duration, activeMultiplier);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-moment-title"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="kibo-fade-in relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-y-auto rounded-3xl border border-teal-500/25 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-2xl sm:p-8"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-400/30 bg-teal-500/20 text-xl text-teal-300 shadow-inner">
              ✦
            </div>
            <div>
              <h2
                id="connect-moment-title"
                className="text-lg font-medium text-white sm:text-xl"
              >
                Connect Moment
              </h2>
              <p className="text-xs text-white/60">
                Shared synchronous presence. Put phones away together to boost nutrient accrual and earn bonus Fish Points.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/50 transition hover:bg-white/15 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">
            Choose Focus Theme
          </label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {CONNECT_MOMENT_CATEGORIES.map((cat) => {
              const cfg = CONNECT_MOMENT_CATEGORY_CONFIG[cat];
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handlePickCategory(cat)}
                  className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? 'border-teal-400/70 bg-teal-500/15 shadow-lg shadow-teal-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xl">{cfg.icon}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide ${
                        isSelected
                          ? 'bg-teal-400/25 text-teal-200'
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {cfg.multiplier.toFixed(1)}x boost
                    </span>
                  </div>
                  <span className="mt-2 text-xs font-medium text-white">
                    {cfg.label}
                  </span>
                  <span className="mt-0.5 text-[11px] leading-tight text-white/50">
                    {cfg.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">
              Session Duration
            </label>
            <span className="font-mono text-sm font-semibold text-teal-200">
              {duration} minutes
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDuration(mins)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  duration === mins
                    ? 'border-teal-400 bg-teal-500/30 text-teal-100 shadow'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>

          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            aria-label="Custom session duration slider"
            className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-teal-400"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-300">⚡</span>
              <span className="text-xs font-medium text-amber-100">
                Phone-Off Multiplier Boost
              </span>
            </div>
            <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-200">
              {activeMultiplier.toFixed(2)}x
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-amber-400/15 pt-2 text-[11px] text-amber-200/80">
            <span>Estimated completion bonus:</span>
            <span className="font-semibold text-amber-100">
              +{estimatedPoints} Fish Points
            </span>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 px-6 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition hover:brightness-110 active:scale-95"
          >
            <span>✦</span>
            <span>Begin Shared Focus</span>
          </button>
        </div>
      </div>
    </div>
  );
}
