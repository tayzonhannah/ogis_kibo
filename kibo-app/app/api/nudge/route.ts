import { timingSafeEqual } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  NUDGE_BATCH_LIMIT,
  NUDGE_IDLE_DAYS,
  type TankMood,
} from '@/lib/constants';
import {
  NUDGE_MODEL,
  NUDGE_SYSTEM_INSTRUCTION,
  buildNudgePrompt,
  sanitizeNudge,
} from '@/lib/nudge';

/**
 * The AI listener. Driven by Vercel Cron — see `crons` in vercel.json.
 *
 * Scheduling was a decision, not a default: the alternative was pg_cron plus
 * pg_net, which means the database also has to hold or reach GEMINI_API_KEY.
 * This way the key lives in exactly one place, the server env, and Vercel sends
 * `Authorization: Bearer $CRON_SECRET` for us.
 *
 * GET rather than POST because that is what Vercel Cron issues. Route Handler
 * GETs have been dynamic by default since 15.0, and reading a request header
 * would force it anyway, so there is nothing to opt out of here.
 */

/** Fail closed, and say which side is missing. */
function unauthorized(reason: string) {
  console.warn(`[kibo] nudge rejected: ${reason}`);
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

function secretMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  // timingSafeEqual throws on length mismatch, so the length check is required
  // rather than an optimisation. Leaking the length of a comparison target is
  // not interesting; leaking a byte-by-byte prefix would be.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // An unauthenticated route that calls a paid API is a billing vulnerability,
  // so a missing secret refuses service rather than skipping the check.
  if (!secret) {
    console.error('[kibo] CRON_SECRET is not set; refusing to run.');
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!secretMatches(request.headers.get('authorization'), secret)) {
    return unauthorized('bad or missing bearer token');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[kibo] GEMINI_API_KEY is not set; refusing to run.');
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }

  const admin = createAdminClient();
  const ai = new GoogleGenAI({ apiKey });

  const cutoff = new Date(
    Date.now() - NUDGE_IDLE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // One extra row beyond the limit, purely so the response can say whether the
  // batch was truncated. A cap that silently drops work reads as "we did
  // everything" in the logs.
  const { data: candidates, error: scanError } = await admin
    .from('rooms')
    .select('id, tank_mood')
    .lt('last_interaction_at', cutoff)
    .or(`last_nudged_at.is.null,last_nudged_at.lt.${cutoff}`)
    .order('last_interaction_at', { ascending: true })
    .limit(NUDGE_BATCH_LIMIT + 1);

  if (scanError) {
    console.error(`[kibo] nudge scan failed: ${scanError.message}`);
    return Response.json({ error: 'scan_failed' }, { status: 500 });
  }

  const rows = (candidates ?? []) as { id: string; tank_mood: TankMood }[];
  const deferred = Math.max(0, rows.length - NUDGE_BATCH_LIMIT);
  const batch = rows.slice(0, NUDGE_BATCH_LIMIT);

  let nudged = 0;
  let skipped = 0;
  let failed = 0;

  for (const room of batch) {
    try {
      // Nudging a room one person joined and nobody else ever did is the wrong
      // message to the wrong person. Phase 4 refuses to credit solo rooms for
      // the same reason: the mechanic is about two people.
      const { data: participants, error: peopleError } = await admin
        .from('room_participants')
        .select('love_language')
        .eq('room_id', room.id);

      if (peopleError) throw new Error(peopleError.message);
      if (!participants || participants.length < 2) {
        skipped += 1;
        continue;
      }

      // Claim the room BEFORE spending anything.
      //
      // Cron delivery is at-least-once and two runs can overlap, so "check then
      // write" would double-nudge. This is a compare-and-set against the same
      // predicate the scan used: whoever flips last_nudged_at first gets the
      // row, and the loser sees zero rows back and moves on. It is also why the
      // window is re-tested here rather than trusted from the scan.
      //
      // nudge_text is cleared in the same statement. Without that, a generation
      // failure after a successful claim would leave a fresh timestamp beside a
      // stale sentence — and the banner dedupes on the timestamp, so the client
      // would replay an old nudge as if it were new.
      const { data: claimed, error: claimError } = await admin
        .from('rooms')
        .update({ last_nudged_at: new Date().toISOString(), nudge_text: null })
        .eq('id', room.id)
        .lt('last_interaction_at', cutoff)
        .or(`last_nudged_at.is.null,last_nudged_at.lt.${cutoff}`)
        .select('id');

      if (claimError) throw new Error(claimError.message);
      if (!claimed || claimed.length === 0) {
        skipped += 1;
        continue;
      }

      const response = await ai.models.generateContent({
        model: NUDGE_MODEL,
        contents: buildNudgePrompt({
          mood: room.tank_mood,
          loveLanguages: participants.map(
            (p) => (p as { love_language: string | null }).love_language
          ),
        }),
        config: {
          systemInstruction: NUDGE_SYSTEM_INSTRUCTION,
          // A hard spend ceiling. The output is one sentence.
          maxOutputTokens: 64,
          temperature: 1,
          // Explicitly off, and load-bearing rather than tidy: thinking tokens
          // are drawn from the same budget as the reply, so an unset thinking
          // budget next to a cap this low is how you get a 200 with empty text
          // and finishReason MAX_TOKENS. There is nothing here worth thinking
          // about anyway.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const text = sanitizeNudge(response.text);
      if (!text) {
        // The claim stands. Burning this room's slot for one window is the safe
        // direction: retrying immediately is how a broken prompt turns into a
        // bill, and the room simply stays quiet until the next window.
        console.warn(`[kibo] nudge for ${room.id} produced no usable text`);
        failed += 1;
        continue;
      }

      const { error: writeError } = await admin
        .from('rooms')
        .update({ nudge_text: text })
        .eq('id', room.id);

      if (writeError) throw new Error(writeError.message);
      nudged += 1;
    } catch (cause) {
      // One bad room does not cancel the batch.
      failed += 1;
      console.error(`[kibo] nudge for ${room.id} failed:`, cause);
    }
  }

  if (deferred > 0) {
    console.warn(
      `[kibo] nudge batch capped at ${NUDGE_BATCH_LIMIT}; ${deferred}+ rooms left for the next run.`
    );
  }

  return Response.json({ scanned: batch.length, nudged, skipped, failed, deferred });
}
