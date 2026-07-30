import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KIBO — offline',
};

/**
 * Precached by public/sw.js and served only when a navigation cannot reach the
 * network at all.
 *
 * No room code, no reconnect button, no retry timer. The tank is two people's
 * live presence and none of it is available here, so offering a way back in from
 * this page would only fail more loudly. Reloading is the browser's job.
 */
export default function Offline() {
  return (
    <main className="flex h-dvh items-center justify-center p-8">
      <div className="kibo-fade-in max-w-xs text-center">
        <p aria-hidden className="text-2xl text-white/25">
          ⌁
        </p>
        <h1 className="mt-4 text-lg font-medium">
          The water&apos;s gone still
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          No connection right now. The tank keeps going without you — come back
          when you&apos;re online.
        </p>
      </div>
    </main>
  );
}
