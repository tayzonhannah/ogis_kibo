'use client';

import Link from 'next/link';
import type { UserProfile } from '@/lib/types';

interface DashboardHeaderProps {
  profile: UserProfile | null;
  onOpenCreate: () => void;
  onOpenJoin: () => void;
  onSignOut: () => Promise<void>;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function DashboardHeader({
  profile,
  onOpenCreate,
  onOpenJoin,
  onSignOut,
  refreshing = false,
  onRefresh,
}: DashboardHeaderProps) {
  const displayName = profile?.displayName || (profile?.email ? profile.email.split('@')[0] : 'Aquanaut');
  const avatarLetter = displayName ? displayName.charAt(0).toUpperCase() : 'A';
  const fishPoints = profile?.fishPoints ?? 0;

  return (
    <header className="w-full border-b border-white/10 bg-black/20 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 lg:px-8">
        {/* Brand & User Profile */}
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
            title="KIBO Dashboard"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400/20 to-blue-500/20 border border-teal-300/30 text-teal-300 shadow-inner">
              <span className="text-lg font-light tracking-tighter">✦</span>
            </div>
            <div>
              <span className="text-lg font-light tracking-[0.3em] text-white/95">KIBO</span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-teal-300/70">
                Ambient Habitat
              </span>
            </div>
          </Link>

          <div className="hidden h-8 w-px bg-white/10 sm:block" />

          {/* User Profile Badge */}
          <div className="flex items-center gap-3">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={displayName}
                className="h-9 w-9 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-medium text-white/80">
                {avatarLetter}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs font-medium text-white/90">{displayName}</span>
              {profile?.email && (
                <span className="text-[11px] text-white/40">{profile.email}</span>
              )}
            </div>
          </div>
        </div>

        {/* Fish Points Wallet & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Fish Points Balance & Link to /vouchers */}
          <Link
            href="/vouchers"
            className="group flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1.5 text-xs text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/20"
            title="View third-space partner vouchers and redeem rewards"
          >
            <span className="text-amber-300 transition-transform group-hover:scale-110">✦</span>
            <span className="font-semibold text-amber-100">{fishPoints}</span>
            <span className="text-[11px] text-amber-300/80">Fish Points</span>
            <span className="text-[10px] text-amber-300/60 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>

          {/* Refresh button if provided */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-50"
              title="Refresh tanks"
              aria-label="Refresh tanks"
            >
              <svg
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}

          {/* Join with Code CTA */}
          <button
            type="button"
            onClick={onOpenJoin}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10 active:scale-95"
          >
            <span className="font-mono text-teal-300">#</span>
            <span>Join via Code</span>
          </button>

          {/* Open New Tank CTA */}
          <button
            type="button"
            onClick={onOpenCreate}
            className="flex items-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-500/20 px-4 py-2 text-xs font-medium text-teal-200 backdrop-blur-sm transition hover:border-teal-300/60 hover:bg-teal-500/30 active:scale-95 shadow-sm shadow-teal-500/10"
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>Open New Tank</span>
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="rounded-full border border-white/10 p-2 text-xs text-white/40 transition hover:border-white/30 hover:text-white/80"
            title="Sign out"
            aria-label="Sign out"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
