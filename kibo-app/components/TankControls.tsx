'use client';

import { useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  MEMO_MAX_LEN,
  TANK_MOODS,
  TANK_MOOD_LABELS,
  TANK_MOOD_GRADIENT,
  WARMTH_COOLDOWN_MS,
  type TankMood,
} from '@/lib/constants';
import type { MemoPayload, WarmthPayload } from '@/lib/types';

/**
 * The overlay: warmth, mood, memos.
 *
 * Transport split, deliberately:
 *  - warmth is broadcast-only. A gesture nobody was present for is a missed
 *    moment, not lost state. It still bumps last_interaction_at through
 *    touch_room(), because the nudge scheduler reads that.
 *  - mood is a Postgres write. It is state, and it must survive a reload.
 *  - memos are inserted first, then broadcast. Persist-then-notify, the same
 *    split as fish handoff: a memo that evaporates because the other person
 *    wasn't looking would undercut the whole point.
 */
export default function TankControls({
  supabase,
  roomId,
  userId,
  channel,
  mood,
  onMoodPicked,
}: {
  supabase: SupabaseClient;
  roomId: string;
  userId: string;
  channel: RealtimeChannel | null;
  mood: TankMood;
  onMoodPicked: (mood: TankMood) => void;
}) {
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const lastWarmthRef = useRef(0);

  const flash = (message: string) => {
    setNote(message);
    setTimeout(() => setNote(null), 3500);
  };

  const sendWarmth = () => {
    if (!channel) return;
    const now = Date.now();
    if (now - lastWarmthRef.current < WARMTH_COOLDOWN_MS) return;
    lastWarmthRef.current = now;

    const payload: WarmthPayload = {
      id: `${userId}:${now}`,
      // Spread the glows along the floor rather than stacking them.
      xFrac: 0.15 + Math.random() * 0.7,
    };
    void channel.send({ type: 'broadcast', event: 'WARMTH_SENT', payload });
    void supabase.rpc('touch_room', { target_room: roomId });
  };

  const pickMood = async (next: TankMood) => {
    setMoodOpen(false);
    if (next === mood) return;
    onMoodPicked(next); // optimistic; the realtime echo confirms it
    const { error } = await supabase
      .from('rooms')
      .update({ tank_mood: next })
      .eq('id', roomId);
    if (error) flash("Couldn't change the water.");
  };

  const sendMemo = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = memo.trim();
    if (!body || busy || !channel) return;
    setBusy(true);

    const { data, error } = await supabase
      .from('memos')
      .insert({ room_id: roomId, author: userId, body })
      .select('id')
      .single();

    setBusy(false);

    if (error) {
      flash(
        error.message.includes('memo_rate_limited')
          ? 'Slow down a little — too many memos just now.'
          : "Couldn't leave that memo."
      );
      return;
    }

    setMemo('');
    const payload: MemoPayload = {
      id: (data as { id: string }).id,
      body,
      xFrac: 0.25 + Math.random() * 0.5,
      yFrac: 0.6 + Math.random() * 0.25,
    };
    void channel.send({ type: 'broadcast', event: 'MEMO_SENT', payload });
  };

  const remaining = MEMO_MAX_LEN - memo.length;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
      <div className="pointer-events-auto mx-auto flex w-full max-w-md flex-col gap-3">
        {note ? (
          <p
            aria-live="polite"
            className="self-center rounded-full bg-black/40 px-3 py-1 text-xs text-amber-200/90 backdrop-blur-sm"
          >
            {note}
          </p>
        ) : null}

        {moodOpen ? (
          <div
            role="radiogroup"
            aria-label="Tank mood"
            className="kibo-fade-in flex flex-wrap justify-center gap-2 rounded-2xl bg-black/30 p-3 backdrop-blur-sm"
          >
            {TANK_MOODS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={option === mood}
                onClick={() => void pickMood(option)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition ${
                  option === mood
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white/90'
                }`}
              >
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full ring-1 ring-white/25"
                  style={{
                    background: `linear-gradient(${TANK_MOOD_GRADIENT[option][0]}, ${TANK_MOOD_GRADIENT[option][1]})`,
                  }}
                />
                {TANK_MOOD_LABELS[option]}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={sendMemo} className="flex items-end gap-2">
          <button
            type="button"
            onClick={sendWarmth}
            title="Send warmth"
            aria-label="Send warmth"
            className="shrink-0 rounded-full bg-amber-200/15 px-4 py-3 text-lg leading-none text-amber-100 backdrop-blur-sm transition hover:bg-amber-200/30"
          >
            ✿
          </button>

          <div className="min-w-0 flex-1">
            <label htmlFor="memo" className="sr-only">
              Leave a small memo
            </label>
            <input
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX_LEN))}
              placeholder="a small memo…"
              autoComplete="off"
              className="w-full rounded-full border border-white/15 bg-black/25 px-4 py-3 text-sm text-white/90 backdrop-blur-sm placeholder:text-white/30 focus:border-white/40 focus:outline-none"
            />
            {memo.length > MEMO_MAX_LEN - 30 ? (
              <p className="mt-1 pl-4 text-[11px] text-white/40">
                {remaining} left
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setMoodOpen((open) => !open)}
            aria-expanded={moodOpen}
            aria-label="Change the water"
            title={`Water: ${TANK_MOOD_LABELS[mood]}`}
            className="shrink-0 rounded-full p-1 ring-1 ring-white/20 backdrop-blur-sm transition hover:ring-white/50"
          >
            <span
              aria-hidden
              className="block h-8 w-8 rounded-full"
              style={{
                background: `linear-gradient(${TANK_MOOD_GRADIENT[mood][0]}, ${TANK_MOOD_GRADIENT[mood][1]})`,
              }}
            />
          </button>
        </form>
      </div>
    </div>
  );
}
