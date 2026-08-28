'use client';

import { VOUCHER_CATEGORY_LABELS } from '@/lib/constants';
import type { VoucherRow } from '@/lib/types';

interface VoucherCardProps {
  voucher: VoucherRow;
  userPoints: number;
  onSelectRedeem: (voucher: VoucherRow) => void;
}

export default function VoucherCard({
  voucher,
  userPoints,
  onSelectRedeem,
}: VoucherCardProps) {
  const canAfford = userPoints >= voucher.points_cost;
  const pointsDeficit = voucher.points_cost - userPoints;
  const categoryLabel =
    VOUCHER_CATEGORY_LABELS[voucher.category] || voucher.category;

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl transition hover:border-teal-500/40 hover:bg-slate-900/80">
      <div>
        {voucher.image_url ? (
          <div className="relative mb-4 h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={voucher.image_url}
              alt={voucher.partner_name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            <div className="absolute bottom-2.5 left-2.5">
              <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md border border-white/10">
                {categoryLabel}
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-4 flex h-28 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/10 to-amber-500/10 border border-white/10">
            <span className="text-2xl opacity-60">✦</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-teal-300/80">
              {voucher.partner_name}
            </span>
            <h3 className="mt-0.5 text-base font-semibold text-white group-hover:text-teal-200 transition-colors">
              {voucher.title}
            </h3>
          </div>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-white/65">
          {voucher.description}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        <div className="flex items-center gap-1.5">
          <span className="text-amber-300">✦</span>
          <span className="font-mono text-sm font-bold text-amber-100">
            {voucher.points_cost}
          </span>
          <span className="text-[11px] text-amber-300/70">pts</span>
        </div>

        <button
          type="button"
          onClick={() => onSelectRedeem(voucher)}
          disabled={!canAfford}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
            canAfford
              ? 'bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 shadow-md shadow-teal-500/20 hover:brightness-110 active:scale-95'
              : 'border border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
          }`}
        >
          {canAfford ? (
            <>
              <span>Redeem</span>
              <span>→</span>
            </>
          ) : (
            <span>Need ${pointsDeficit} pts</span>
          )}
        </button>
      </div>
    </div>
  );
}
