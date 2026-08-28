'use client';

import { useEffect, useState } from 'react';

interface CreateTankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<{ room_id: string; room_code: string } | null>;
}

function CreateTankDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<{ room_id: string; room_code: string } | null>;
}) {
  const [name, setName] = useState('');
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

    setBusy(true);
    setError(null);

    const trimmed = name.trim();
    const finalName = trimmed || 'Shared Tank';

    try {
      const res = await onCreate(finalName);
      if (!res) {
        setError('Could not create tank. Please try again.');
        setBusy(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room.';
      setError(message);
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-tank-title"
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
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-500/20 text-xs text-teal-300">
              ✦
            </span>
            <h2
              id="create-tank-title"
              className="text-lg font-light tracking-wide text-white/95"
            >
              Open New Tank
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
              htmlFor="tank-name-input"
              className="block text-xs font-medium uppercase tracking-wider text-white/60"
            >
              Tank Name
            </label>
            <input
              id="tank-name-input"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Tea, Focus Pod, Family Haven"
              maxLength={50}
              disabled={busy}
              className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
            <p className="mt-1.5 text-[11px] text-white/40">
              Give your shared sanctuary a distinctive name. Supports up to 5 members.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
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
              disabled={busy}
              className="flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-500/20 px-6 py-2.5 text-xs font-medium text-teal-200 shadow-sm transition hover:border-teal-300 hover:bg-teal-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
                  <span>Opening Tank…</span>
                </>
              ) : (
                <span>Open Tank</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreateTankModal({
  isOpen,
  onClose,
  onCreate,
}: CreateTankModalProps) {
  if (!isOpen) return null;
  return <CreateTankDialog onClose={onClose} onCreate={onCreate} />;
}
