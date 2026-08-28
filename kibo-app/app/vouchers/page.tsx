'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import PointsWalletHeader from '@/components/vouchers/PointsWalletHeader';
import VoucherFilters from '@/components/vouchers/VoucherFilters';
import VoucherCard from '@/components/vouchers/VoucherCard';
import RedemptionModal from '@/components/vouchers/RedemptionModal';
import type { VoucherRow, VoucherRedemptionRow } from '@/lib/types';

export default function VouchersPage() {
  const router = useRouter();
  const { status, profile, userId, supabase, signOut, refreshProfile } =
    useAuth();

  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [redemptions, setRedemptions] = useState<VoucherRedemptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'points_asc' | 'points_desc' | 'name'>(
    'points_asc'
  );

  // Modal state
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherRow | null>(
    null
  );

  const fetchVouchers = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('is_active', true)
        .order('points_cost', { ascending: true });

      if (error) {
        console.error('Error fetching vouchers:', error);
      } else if (data) {
        setVouchers(data as VoucherRow[]);
      }
    } catch (err) {
      console.error('Failed to load vouchers:', err);
    }
  }, [supabase]);

  const fetchRedemptions = useCallback(async () => {
    if (!supabase || !userId) return;
    try {
      const { data, error } = await supabase
        .from('voucher_redemptions')
        .select('*, voucher:vouchers(*)')
        .eq('user_id', userId)
        .order('redeemed_at', { ascending: false });

      if (error) {
        console.error('Error fetching redemptions:', error);
      } else if (data) {
        setRedemptions(data as VoucherRedemptionRow[]);
      }
    } catch (err) {
      console.error('Failed to load redemptions:', err);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    if (!supabase || status !== 'ready') return;

    let isMounted = true;
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchVouchers(), fetchRedemptions()]);
      if (isMounted) setLoading(false);
    };

    void loadAll();

    const channel = supabase
      .channel('vouchers_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vouchers' },
        () => {
          void fetchVouchers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voucher_redemptions',
          filter: userId ? `user_id=eq.${userId}` : undefined,
        },
        () => {
          void fetchRedemptions();
          void refreshProfile();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [status, supabase, userId, router, fetchVouchers, fetchRedemptions, refreshProfile]);

  const filteredVouchers = vouchers
    .filter((v) => {
      if (selectedCategory !== 'all' && v.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = v.title.toLowerCase().includes(q);
        const matchPartner = v.partner_name.toLowerCase().includes(q);
        const matchDesc = v.description.toLowerCase().includes(q);
        if (!matchTitle && !matchPartner && !matchDesc) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'points_asc') return a.points_cost - b.points_cost;
      if (sortBy === 'points_desc') return b.points_cost - a.points_cost;
      if (sortBy === 'name') return a.partner_name.localeCompare(b.partner_name);
      return 0;
    });

  const handleRedeemedSuccess = () => {
    void refreshProfile();
    void fetchRedemptions();
  };

  if (status === 'loading' || loading) {
    return (
      <main className="flex h-dvh w-full items-center justify-center bg-slate-950">
        <div className="kibo-fade-in flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl border border-teal-400/30 bg-teal-500/10 text-2xl text-teal-300">
            ✦
          </div>
          <p className="text-xs text-white/50">Loading partner catalog...</p>
        </div>
      </main>
    );
  }

  const userPoints = profile?.fishPoints ?? 0;

  return (
    <main className="min-h-dvh w-full bg-slate-950 text-white selection:bg-teal-400/30">
      <PointsWalletHeader profile={profile} onSignOut={signOut} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex border-b border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`border-b-2 px-6 py-3 text-sm font-medium transition ${
              activeTab === 'catalog'
                ? 'border-teal-400 text-teal-200'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            Voucher Catalog ({vouchers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`border-b-2 px-6 py-3 text-sm font-medium transition ${
              activeTab === 'history'
                ? 'border-teal-400 text-teal-200'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            My Redeemed Codes ({redemptions.length})
          </button>
        </div>

        {activeTab === 'catalog' ? (
          <div className="flex flex-col gap-8">
            <VoucherFilters
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />

            {filteredVouchers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 p-12 text-center">
                <span className="text-3xl">☕</span>
                <h3 className="mt-3 text-sm font-medium text-white">
                  No matching partner vouchers
                </h3>
                <p className="mt-1 text-xs text-white/50 max-w-xs">
                  Try adjusting your category filter or search query.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="mt-4 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVouchers.map((voucher) => (
                  <VoucherCard
                    key={voucher.id}
                    voucher={voucher}
                    userPoints={userPoints}
                    onSelectRedeem={(v) => setSelectedVoucher(v)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {redemptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 p-12 text-center">
                <span className="text-3xl">🎟️</span>
                <h3 className="mt-3 text-sm font-medium text-white">
                  No redeemed vouchers yet
                </h3>
                <p className="mt-1 text-xs text-white/50 max-w-xs">
                  Spend your Fish Points on partner perks in the catalog to claim discount codes.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="mt-4 rounded-full bg-teal-500/20 border border-teal-400/30 px-4 py-1.5 text-xs text-teal-200 hover:bg-teal-500/30"
                >
                  Browse Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {redemptions.map((redemption) => {
                  const v = redemption.voucher;
                  return (
                    <div
                      key={redemption.id}
                      className="flex flex-col justify-between rounded-2xl border border-teal-500/30 bg-slate-900/70 p-5 backdrop-blur-xl"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">
                            {v?.partner_name || 'Partner Voucher'}
                          </span>
                          <span className="text-[10px] text-white/40">
                            {new Date(redemption.redeemed_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="mt-1 text-sm font-semibold text-white">
                          {v?.title || 'Reward Perk'}
                        </h4>
                        <p className="mt-1 text-xs text-white/60">
                          {v?.description}
                        </p>
                      </div>

                      <div className="mt-4 rounded-xl border border-white/10 bg-black/50 p-3">
                        <span className="block text-[10px] uppercase text-teal-300/70">
                          Discount Code
                        </span>
                        <div className="mt-0.5 flex items-center justify-between">
                          <span className="font-mono text-sm font-bold text-white">
                            {v?.discount_code || 'CODE-REDEEMED'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (v?.discount_code) {
                                void navigator.clipboard.writeText(v.discount_code);
                              }
                            }}
                            className="text-xs text-teal-300 hover:text-teal-200"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {supabase && (
        <RedemptionModal
          isOpen={selectedVoucher !== null}
          onClose={() => setSelectedVoucher(null)}
          voucher={selectedVoucher}
          userPoints={userPoints}
          onRedeemedSuccess={handleRedeemedSuccess}
          supabase={supabase}
        />
      )}
    </main>
  );
}
