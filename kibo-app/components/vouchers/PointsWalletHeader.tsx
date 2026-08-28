'use client';

import Link from 'next/link';
import type { UserProfile } from '@/lib/types';

interface PointsWalletHeaderProps {
  profile: UserProfile | null;
  onSignOut?: () => Promise<void>;
}

export default function PointsWalletHeader({
  profile,
  onSignOut,
}: PointsWalletHeaderProps) {
  const displayName =
    profile?.displayName ||
    (profile?.email ? profile.email.split('@')[0] : 'Aquanaut');
  const fishPoints = profile?.fishPoints ?? 0;

  return (
    <header className="w-full border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 text-xs text-white/60 transition hover:text-white"
              title="Return to Dashboard"
            >
              <span className="text-teal-300 transition-transform group-hover:-translate-x-0.5">
                ←
              </span>
              <span>Dashboard</span>
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-xs font-medium text-teal-300">
              Partner Rewards
            </span>
          </div>

          <div className="flex items-center gap-3">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={displayName}
                className="h-8 w-8 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-medium text-white/80">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden text-xs text-white/80 sm:inline">
              {displayName}
            </span>
            {onSignOut && (
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-slate-900/80 to-teal-500/10 p-6 shadow-2xl shadow-amber-500/5 sm:p-8">
          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                <span>✦</span>
                <span className="font-semibold">Third-Space Partner Program</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Redeem Local Perks & Experiences
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-white/70 sm:text-sm">
                Earn Fish Points automatically by spending phone-off focus time in your tanks.
                Exchange points for artisanal coffee, indie books, wellness floats, and dining discounts at partner venues.
              </p>
            </div>

            <div className="flex flex-col items-start rounded-2xl border border-amber-400/40 bg-black/40 p-5 backdrop-blur-md md:items-end">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">
                Your Fish Points Balance
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-4xl font-extrabold text-amber-100 sm:text-5xl">
                  {fishPoints}
                </span>
                <span className="text-sm font-semibold text-amber-300">pts</span>
              </div>
              <span className="mt-1 text-[11px] text-white/40">
                Updated in real-time from active tanks
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
