'use client';

import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VoucherRow } from '@/lib/types';

interface RedemptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: VoucherRow | null;
  userPoints: number;
  onRedeemedSuccess: (remainingPoints: number) => void;
  supabase: SupabaseClient;
}

export default function RedemptionModal({
  isOpen,
  onClose,
  voucher,
  userPoints,
  onRedeemedSuccess,
  supabase,
}: RedemptionModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setRevealedCode(null);
    setErrorMsg(null);
    setCopied(false);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!isOpen || !voucher) return null;

  const remainingAfter = userPoints - voucher.points_cost;

  const handleConfirmRedemption = async () => {
    if (userPoints < voucher.points_cost) {
      setErrorMsg('Insufficient Fish Points for this reward.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.rpc('redeem_voucher', {
        target_voucher_id: voucher.id,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to redeem voucher.');
        return;
      }

      const row = (data as Array<{
        status: string;
        redemption_id: string | null;
        remaining_points: number | null;
      }>)?.[0];

      if (!row || row.status !== 'ok') {
        if (row?.status === 'insufficient_points') {
          setErrorMsg('Insufficient Fish Points balance.');
        } else {
          setErrorMsg('Voucher unavailable or already redeemed.');
        }
        return;
      }

      setRevealedCode(voucher.discount_code);
      if (row.remaining_points !== null) {
        onRedeemedSuccess(row.remaining_points);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Redemption failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!revealedCode) return;
    try {
      await navigator.clipboard.writeText(revealedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="redemption-modal-title"
      onClick={(e) => {
        e.stopPropagation();
        handleClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="kibo-fade-in relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-3xl border border-teal-500/25 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl sm:p-8"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/20 text-xl text-amber-300 shadow-inner">
              ✦
            </div>
            <div>
              <h2
                id="redemption-modal-title"
                className="text-base font-bold text-white sm:text-lg"
              >
                {revealedCode ? 'Reward Claimed!' : 'Confirm Redemption'}
              </h2>
              <span className="text-xs text-white/50">
                {voucher.partner_name}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/50 transition hover:bg-white/15 hover:text-white"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        {revealedCode ? (
          <div className="mt-6 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/40 text-2xl text-emerald-300">
              ✓
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">
              {voucher.title}
            </h3>
            <p className="mt-1 text-xs text-white/60">
              Present this code at any {voucher.partner_name} location or enter at online checkout.
            </p>

            <div className="mt-5 w-full rounded-2xl border border-teal-400/40 bg-black/60 p-4">
              <span className="text-[10px] uppercase tracking-wider text-teal-300/80">
                Your Exclusive Voucher Code
              </span>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-bold tracking-wider text-white">
                  {revealedCode}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  className="rounded-xl border border-teal-400/40 bg-teal-500/20 px-3 py-1.5 text-xs font-medium text-teal-200 transition hover:bg-teal-500/30"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="mt-6 w-full rounded-full bg-white/10 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold text-white">
                {voucher.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                {voucher.description}
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Current Balance:</span>
                <span className="font-mono text-white">{userPoints} pts</span>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Voucher Cost:</span>
                <span className="font-mono font-semibold">
                  -{voucher.points_cost} pts
                </span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-white">
                <span>Remaining Balance:</span>
                <span className="font-mono text-teal-200">
                  {Math.max(0, remainingAfter)} pts
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRedemption()}
                disabled={submitting || userPoints < voucher.points_cost}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:opacity-50"
              >
                <span>✦</span>
                <span>{submitting ? 'Redeeming…' : 'Confirm & Redeem'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
