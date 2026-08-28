'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { CODE_LENGTH, isPlausibleCode, normalizeCode } from '@/lib/constants';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, user, error: authError, signInWithGoogle, signInAsDemoUser } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const errorParam = searchParams.get('error');

  // Automatically redirect authenticated users to the Multi-Tank Dashboard
  useEffect(() => {
    if (status === 'ready' && user) {
      router.replace('/dashboard');
    }
  }, [status, user, router]);

  const handleGoogleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setMessage(msg);
      setBusy(false);
    }
  };

  const handleDemoSignIn = async (name: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await signInAsDemoUser(name);
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Demo sign-in failed.';
      setMessage(msg);
      setBusy(false);
    }
  };

  const handleDirectJoin = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeCode(code);
    if (!isPlausibleCode(normalized)) {
      setMessage(`A tank code is ${CODE_LENGTH} letters and numbers.`);
      return;
    }
    setMessage(null);
    router.push(`/room/${normalized}`);
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 sm:p-8">
      <div className="kibo-fade-in w-full max-w-md rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <h1 className="text-3xl font-light tracking-[0.4em] text-white/95 sm:text-4xl">
            KIBO
          </h1>
          <p className="mt-3 text-xs uppercase tracking-[0.25em] text-teal-300/80">
            Ambient Shared Aquarium
          </p>
          <p className="mt-5 text-sm leading-relaxed text-white/60">
            A serene, ambient habitat for close groups. Rest your phone, watch your
            fish cross between screens, and collect reciprocity rewards together.
          </p>
        </div>

        {/* Primary Action: Google Sign-in */}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={status === 'loading' || busy}
            className="group flex w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-medium text-white transition-all hover:border-white/40 hover:bg-white/15 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110"
              viewBox="0 0 24 24"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{busy ? 'Connecting to Google…' : 'Sign in with Google'}</span>
          </button>

          {/* Local / Demo Fast Login Options */}
          <div className="pt-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
              Fast Demo Mode (Instant Sandbox Login)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleDemoSignIn('Alex')}
                disabled={busy}
                className="flex-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs font-medium text-teal-200 hover:bg-teal-500/20 transition"
              >
                Enter as Alex
              </button>
              <button
                type="button"
                onClick={() => void handleDemoSignIn('Leo')}
                disabled={busy}
                className="flex-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 transition"
              >
                Enter as Leo
              </button>
            </div>
          </div>
        </div>

        {/* Direct Tank Code Option */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative bg-[#0d1f2d] px-3 text-[11px] uppercase tracking-[0.2em] text-white/35">
            or enter with code
          </span>
        </div>

        <form onSubmit={handleDirectJoin} className="flex gap-2">
          <input
            id="tank-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD2345"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={CODE_LENGTH}
            className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-white/90 placeholder:text-white/25 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-full border border-white/20 px-5 text-xs text-white/80 transition hover:border-white/50 hover:text-white"
          >
            Enter
          </button>
        </form>

        {/* Feedback / Error Notifications */}
        <div className="mt-5 min-h-8 text-center text-xs text-amber-200/80">
          {errorParam === 'auth_callback_failed' && (
            <p>Authentication failed or was cancelled. Please try again.</p>
          )}
          {message && <p>{message}</p>}
          {status === 'error' && <p>{authError}</p>}
          {status === 'loading' && !message && <p className="text-white/40">Initializing session…</p>}
        </div>

        {/* Feature Pills */}
        <div className="mt-6 flex flex-wrap justify-center gap-2 border-t border-white/10 pt-6 text-[11px] text-white/45">
          <span className="rounded-full bg-white/5 px-3 py-1">Multi-Tank Spaces</span>
          <span className="rounded-full bg-white/5 px-3 py-1">Up to 5 Members</span>
          <span className="rounded-full bg-white/5 px-3 py-1">Partner Vouchers</span>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center p-8">
          <p className="text-sm text-white/50">Loading KIBO…</p>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
