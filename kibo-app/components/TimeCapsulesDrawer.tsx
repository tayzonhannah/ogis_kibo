'use client';

import { useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimeCapsuleRow } from '@/lib/types';

interface TimeCapsulesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
  supabase: SupabaseClient;
  glassmorphicTheme?: string;
}

export default function TimeCapsulesDrawer({
  isOpen,
  onClose,
  roomId,
  userId,
  supabase,
}: TimeCapsulesDrawerProps) {
  const [tab, setTab] = useState<'feed' | 'create'>('feed');
  const [capsules, setCapsules] = useState<TimeCapsuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  // Form State
  const [title, setTitle] = useState('');
  const [memoryText, setMemoryText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [lockMode, setLockMode] = useState<'now' | 'future'>('now');
  const [futureDateStr, setFutureDateStr] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000); // 1 week default
    return d.toISOString().slice(0, 16);
  });

  const loadCapsules = useCallback(async () => {
    if (!supabase || !roomId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('time_capsules')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching time capsules:', error);
      } else if (data) {
        setCapsules(data as TimeCapsuleRow[]);
      }
    } catch (err) {
      console.error('Failed to load time capsules:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, roomId]);

  useEffect(() => {
    if (!isOpen || !roomId || !supabase) return;

    let active = true;
    const fetchFresh = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('time_capsules')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching time capsules:', error);
        } else if (data && active) {
          setCapsules(data as TimeCapsuleRow[]);
        }
      } catch (err) {
        console.error('Failed to load time capsules:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchFresh();

    const channel = supabase
      .channel(`time_capsules:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_capsules',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void fetchFresh();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [isOpen, roomId, supabase]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanText = memoryText.trim();
    const cleanMedia = mediaUrl.trim() || null;

    if (!cleanTitle) {
      setErrorMsg('Please give your memory or capsule a title.');
      return;
    }
    if (!cleanText) {
      setErrorMsg('Please share a memory or story.');
      return;
    }

    let unlockAt: string;
    if (lockMode === 'now') {
      unlockAt = new Date().toISOString();
    } else {
      const parsed = new Date(futureDateStr);
      if (Number.isNaN(parsed.getTime())) {
        setErrorMsg('Please select a valid future unlock date.');
        return;
      }
      unlockAt = parsed.toISOString();
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const isPastOrNow = new Date(unlockAt).getTime() <= Date.now();
      const { error } = await supabase.from('time_capsules').insert({
        room_id: roomId,
        created_by: userId,
        title: cleanTitle,
        memory_text: cleanText,
        media_url: cleanMedia,
        unlock_at: unlockAt,
        unlocked: isPastOrNow,
      });

      if (error) {
        setErrorMsg(`Failed to deposit capsule: ${error.message}`);
      } else {
        setTitle('');
        setMemoryText('');
        setMediaUrl('');
        setLockMode('now');
        setTab('feed');
        void loadCapsules();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-capsules-drawer-title"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="kibo-fade-in relative flex h-full w-full max-w-lg flex-col border-l border-teal-500/25 bg-slate-950/90 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-teal-400/30 bg-teal-500/20 text-lg text-teal-300 shadow-inner">
              📜
            </div>
            <div>
              <h2
                id="time-capsules-drawer-title"
                className="text-base font-medium text-white sm:text-lg"
              >
                Milestones & Time Capsules
              </h2>
              <p className="text-xs text-white/50">
                Shared memory vault for this tank
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/50 transition hover:bg-white/15 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-white/10 bg-black/30 p-2">
          <button
            type="button"
            onClick={() => setTab('feed')}
            className={`flex-1 rounded-xl py-2 text-xs font-medium transition ${
              tab === 'feed'
                ? 'bg-teal-500/20 text-teal-200 shadow'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Memories Feed ({capsules.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`flex-1 rounded-xl py-2 text-xs font-medium transition ${
              tab === 'create'
                ? 'bg-teal-500/20 text-teal-200 shadow'
                : 'text-white/60 hover:text-white'
            }`}
          >
            + Deposit Memory
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === 'create' ? (
            <form onSubmit={handleDeposit} className="flex flex-col gap-4">
              {errorMsg && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-white/80">
                  Milestone / Memory Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Sunset Walk at Mount Tamalpais"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80">
                  Memory Story / Note *
                </label>
                <textarea
                  required
                  rows={4}
                  maxLength={2000}
                  value={memoryText}
                  onChange={(e) => setMemoryText(e.target.value)}
                  placeholder="Capture this moment, inside jokes, or reflections to remember together..."
                  className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-black/30 px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-teal-400 focus:outline-none"
                />
                <span className="mt-1 block text-right text-[10px] text-white/40">
                  {memoryText.length} / 2000
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80">
                  Photo / Media URL (Optional)
                </label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-teal-300/80">
                  Unlock Schedule
                </label>
                <div className="mt-2.5 flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-white/90">
                    <input
                      type="radio"
                      name="lockMode"
                      checked={lockMode === 'now'}
                      onChange={() => setLockMode('now')}
                      className="accent-teal-400"
                    />
                    <span>✨ Activity Milestone (Unlocked Immediately)</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-white/90">
                    <input
                      type="radio"
                      name="lockMode"
                      checked={lockMode === 'future'}
                      onChange={() => setLockMode('future')}
                      className="accent-teal-400"
                    />
                    <span>🔒 Time Capsule (Seal until future date)</span>
                  </label>
                </div>

                {lockMode === 'future' && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <label className="block text-[11px] text-teal-200/80">
                      Select Unlock Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={futureDateStr}
                      onChange={(e) => setFutureDateStr(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-white focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTab('feed')}
                  className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70 transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 px-5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:opacity-50"
                >
                  <span>✦</span>
                  <span>{submitting ? 'Depositing…' : 'Deposit Capsule'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="py-12 text-center text-xs text-white/50">
                  Retrieving memories…
                </div>
              ) : capsules.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 p-8 text-center">
                  <span className="text-3xl">🏺</span>
                  <p className="mt-3 text-sm font-medium text-white/90">
                    No memories deposited yet
                  </p>
                  <p className="mt-1 text-xs text-white/50 max-w-xs">
                    Seal your first shared moment or milestone in this tank.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('create')}
                    className="mt-4 rounded-full bg-teal-500/20 border border-teal-400/40 px-4 py-1.5 text-xs text-teal-200 hover:bg-teal-500/30"
                  >
                    + Deposit First Memory
                  </button>
                </div>
              ) : (
                capsules.map((c) => {
                  const unlockDate = new Date(c.unlock_at);
                  const isUnlocked =
                    c.unlocked || unlockDate.getTime() <= nowMs;

                  return (
                    <article
                      key={c.id}
                      className={`overflow-hidden rounded-2xl border transition-all ${
                        isUnlocked
                          ? 'border-teal-500/30 bg-white/5 hover:border-teal-500/50'
                          : 'border-white/10 bg-black/40 opacity-80'
                      }`}
                    >
                      <div className="flex items-start justify-between border-b border-white/10 p-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">
                            {isUnlocked ? '✨' : '🔒'}
                          </span>
                          <div>
                            <h3 className="text-sm font-semibold text-white">
                              {c.title}
                            </h3>
                            <span className="text-[10px] text-white/40">
                              {new Date(c.created_at).toLocaleDateString(
                                undefined,
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                }
                              )}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                            isUnlocked
                              ? 'bg-teal-400/20 text-teal-200 border border-teal-400/30'
                              : 'bg-amber-400/20 text-amber-200 border border-amber-400/30'
                          }`}
                        >
                          {isUnlocked
                            ? 'Unlocked'
                            : `Unlocks ${unlockDate.toLocaleDateString()}`}
                        </span>
                      </div>

                      <div className="p-4">
                        {isUnlocked ? (
                          <>
                            {c.media_url && (
                              <div className="mb-3 overflow-hidden rounded-xl border border-white/10">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={c.media_url}
                                  alt={c.title}
                                  className="h-44 w-full object-cover"
                                />
                              </div>
                            )}
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/80">
                              {c.memory_text}
                            </p>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 p-6 text-center">
                            <span className="text-2xl opacity-60">⏳</span>
                            <p className="mt-2 font-mono text-xs font-semibold text-amber-200/90">
                              Time Capsule Sealed
                            </p>
                            <p className="mt-1 text-[11px] text-white/40">
                              This memory is sealed until{' '}
                              <span className="text-white/70">
                                {unlockDate.toLocaleString()}
                              </span>
                              .
                            </p>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
