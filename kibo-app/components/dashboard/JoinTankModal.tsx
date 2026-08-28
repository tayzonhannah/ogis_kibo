'use client';

import { useEffect, useState } from 'react';
import { CODE_LENGTH, isPlausibleCode, normalizeCode } from '@/lib/constants';
import { ROOM_ERROR_COPY, type RoomError } from '@/lib/types';

interface JoinTankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<{ status: string; joined_room?: string | null } | null>;
}

function JoinTankDialog({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (code: string) => Promise<{ status: string; joined_room?: string | null } | null>;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const normalized = normalizeCode(code);
    if (!isPlausibleCode(normalized)) {
      setError(`A tank code must be exactly ${CODE_LENGTH} letters and digits.`);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await onJoin(normalized);
      if (!res || res.status !== 'ok') {
        const statusKey = (res?.status as RoomError) || 'unknown';
        const errorCopy = ROOM_ERROR_COPY[statusKey] || 'Could not join this tank. Check code and try again.';
        setError(errorCopy);
        setBusy(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room.';
      setError(message);
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-tank-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="kibo-fade-in relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[#091d2c]/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/20 font-mono text-xs font-bold text-blue-300">
              #
            </span>
            <h2
              id="join-tank-title"
              className="text-lg font-light tracking-wide text-white/95"
            >
              Join via Tank Code
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="tank-code-input"
              className="block text-xs font-medium uppercase tracking-wider text-white/60"
            >
              8-Character Code
            </label>
            <input
              id="tank-code-input"
              type="text"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD2345"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={CODE_LENGTH}
              disabled={busy}
              className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-center font-mono text-base uppercase tracking-[0.3em] text-white placeholder:text-white/20 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <p className="mt-1.5 text-[11px] text-white/40">
              Enter the unique invite code shared by your friend or group member.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full px-5 py-2.5 text-xs text-white/60 transition hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || code.trim().length === 0}
              className="flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/20 px-6 py-2.5 text-xs font-medium text-blue-200 shadow-sm transition hover:border-blue-300 hover:bg-blue-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" />
                  <span>Entering Tank…</span>
                </>
              ) : (
                <span>Join Tank</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function JoinTankModal({
  isOpen,
  onClose,
  onJoin,
}: JoinTankModalProps) {
  if (!isOpen) return null;
  return <JoinTankDialog onClose={onClose} onJoin={onJoin} />;
}
