'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { CODE_LENGTH, isPlausibleCode, normalizeCode } from '@/lib/constants';
import { ROOM_ERROR_COPY, toRoomError } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const { supabase, status, error: authError } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ready = status === 'ready' && supabase !== null;

  const openTank = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc('create_room');
    if (error) {
      setMessage(ROOM_ERROR_COPY[toRoomError(error.message)]);
      setBusy(false);
      return;
    }
    router.push(`/room/${data as string}`);
  };

  const enterTank = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeCode(code);
    // Validate the shape here so a typo doesn't spend one of the ten join
    // attempts the database allows per fifteen minutes.
    if (!isPlausibleCode(normalized)) {
      setMessage(`A tank code is ${CODE_LENGTH} letters and numbers.`);
      return;
    }
    setMessage(null);
    router.push(`/room/${normalized}`);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <div className="kibo-fade-in w-full max-w-sm">
        <h1 className="text-3xl font-light tracking-[0.35em] text-white/90">
          KIBO
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          A shared tank for two. Leave it be and it keeps going — the fish swim
          between your screens whether or not anyone says anything.
        </p>

        <button
          type="button"
          onClick={() => void openTank()}
          disabled={!ready || busy}
          className="mt-10 w-full rounded-full bg-white/10 px-5 py-3 text-sm text-white/90 backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Filling a tank…' : 'Open a new tank'}
        </button>

        <form onSubmit={enterTank} className="mt-8">
          <label
            htmlFor="code"
            className="block text-xs uppercase tracking-[0.2em] text-white/40"
          >
            or join one
          </label>
          <div className="mt-3 flex gap-2">
            <input
              id="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ABCD2345"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={CODE_LENGTH}
              className="min-w-0 flex-1 rounded-full border border-white/15 bg-transparent px-4 py-3 font-mono text-sm uppercase tracking-[0.2em] text-white/90 placeholder:text-white/25 focus:border-white/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!ready}
              className="rounded-full border border-white/20 px-5 text-sm text-white/80 transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enter
            </button>
          </div>
        </form>

        <p
          aria-live="polite"
          className="mt-5 min-h-10 text-xs leading-relaxed text-amber-200/70"
        >
          {message ?? (status === 'error' ? authError : null)}
          {status === 'loading' && !message ? 'Connecting…' : null}
        </p>
      </div>
    </main>
  );
}
