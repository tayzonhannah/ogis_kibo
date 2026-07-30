'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LOVE_LANGUAGES,
  LOVE_LANGUAGE_LABELS,
  type LoveLanguage,
} from '@/lib/constants';
import type { ParticipantRow } from '@/lib/types';

/**
 * Asked once, on the first visit where this participant has no answer stored.
 *
 * The value exists for exactly one reader: the nudge job, which needs to know
 * what a quiet room's two people actually want from each other before it writes
 * a sentence to one of them. Nothing in the tank renders it, which is why the
 * card says what it is for — a preference picker with no visible effect reads as
 * a survey.
 *
 * Skipping is remembered per device in localStorage rather than in a column.
 * "Asked and declined" would need either a nullable third state on
 * love_language — which the 0006 check constraint deliberately forbids — or a
 * new column with a client update grant, and the whole point of the Phase 5
 * grant story is to add no new client-writable state. The cost is that clearing
 * browser storage asks once more. That is the right way round: a re-ask is mild,
 * and a forgeable preference feeding a language model is not.
 */
export default function LoveLanguagePicker({
  supabase,
  roomId,
  userId,
}: {
  supabase: SupabaseClient;
  roomId: string;
  userId: string;
}) {
  // 'unknown' until the row comes back, so the card cannot flash for someone who
  // answered months ago.
  const [visible, setVisible] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const skipKey = `kibo:love-language-skipped:${roomId}`;

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        if (localStorage.getItem(skipKey)) {
          if (active) setVisible('no');
          return;
        }
      } catch {
        // Private-mode Safari throws on localStorage. Fall through and ask;
        // being asked twice is a better failure than crashing the tank.
      }

      const { data, error } = await supabase
        .from('room_participants')
        .select('love_language')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!active) return;
      // On error, stay quiet. An unanswerable read is not a reason to interrupt.
      if (error || !data) {
        setVisible('no');
        return;
      }
      const row = data as Pick<ParticipantRow, 'love_language'>;
      setVisible(row.love_language ? 'no' : 'yes');
    })();

    return () => {
      active = false;
    };
  }, [supabase, roomId, userId, skipKey]);

  const skip = () => {
    try {
      localStorage.setItem(skipKey, '1');
    } catch {
      // Nothing to do; it will be asked again next load.
    }
    setVisible('no');
  };

  /**
   * Awaited rather than sent through fire(): the card dismisses itself on
   * success, so this write does have a visible local effect and the result is
   * genuinely needed. Never `void` it — that sends no request at all.
   */
  const pick = async (choice: LoveLanguage) => {
    if (saving) return;
    setSaving(true);
    setFailed(false);

    const { error } = await supabase
      .from('room_participants')
      .update({ love_language: choice })
      .eq('room_id', roomId)
      .eq('user_id', userId);

    setSaving(false);

    if (error) {
      setFailed(true);
      return;
    }
    setVisible('no');
  };

  if (visible !== 'yes') return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div
        role="group"
        aria-label="What lands best for you"
        className="kibo-fade-in pointer-events-auto w-full max-w-sm rounded-3xl bg-black/40 p-6 backdrop-blur-md"
      >
        <h2 className="text-sm font-medium text-white/90">
          What lands best for you?
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          Used only to shape the occasional reminder when the tank has been quiet
          for a while. Never shared with the other fish.
        </p>

        <div className="mt-4 flex flex-col gap-1.5">
          {LOVE_LANGUAGES.map((option) => (
            <button
              key={option}
              type="button"
              disabled={saving}
              onClick={() => void pick(option)}
              className="rounded-full px-4 py-2.5 text-left text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              {LOVE_LANGUAGE_LABELS[option]}
            </button>
          ))}
        </div>

        {failed ? (
          <p aria-live="polite" className="mt-3 text-xs text-amber-200/90">
            That didn&apos;t save. Try again, or skip for now.
          </p>
        ) : null}

        <button
          type="button"
          onClick={skip}
          className="mt-4 text-xs text-white/35 transition hover:text-white/70"
        >
          not now
        </button>
      </div>
    </div>
  );
}
