import {
  LOVE_LANGUAGE_HINTS,
  NUDGE_MAX_LEN,
  TANK_MOOD_LABELS,
  isLoveLanguage,
  type TankMood,
} from './constants';

/**
 * Prompt construction and output sanitation for the nudge job.
 *
 * Kept separate from the route so both halves can be exercised without an API
 * key, a database, or a cron secret — these are the two places where a mistake is
 * silent rather than loud. A bad prompt still returns 200.
 *
 * No `server-only` import: there is nothing secret in here. The key lives in the
 * route.
 */

/**
 * Pinned deliberately. `gemini-flash-latest` exists as a floating alias and is
 * the wrong choice for a scheduled job: a silent model change behind a cron
 * trigger is a debugging trap, discovered days later through the output. Upgrade
 * path if nudge quality matters more than cost is `gemini-3.6-flash`.
 *
 * Verified against ai.google.dev/gemini-api/docs/models at implementation time:
 * `gemini-3.5-flash-lite` is stable. The SDK surface was verified too — 2.14.0
 * exposes `models.generateContent`, not the `interactions.create` form some
 * quickstarts show.
 */
export const NUDGE_MODEL = 'gemini-3.5-flash-lite';

/**
 * The tank has no idea who these people are, and neither does the model.
 *
 * Note what is absent: memo bodies, the room code, anything either person has
 * ever written. Memos are private between two people, and the nudge does not
 * need them — it needs to know the room went quiet and roughly what warmth looks
 * like to whoever is reading. Sending the conversation would buy nothing and
 * spend the one thing the app is asking to be trusted with.
 */
export const NUDGE_SYSTEM_INSTRUCTION = [
  'You write a single short line for a calm ambient app called KIBO, which is a',
  'shared aquarium for two people. The line appears when their tank has been',
  'quiet for a few days.',
  '',
  'Rules:',
  '- One sentence. Under 18 words. No greeting, no sign-off, no emoji.',
  '- Suggest one small, low-effort gesture. Never imply anyone did wrong.',
  '- Never mention guilt, streaks, obligation, scores, or how long it has been',
  '  in units of days.',
  '- No quotation marks around the line. Output the line only.',
  '- Tone: unhurried and warm. This is weather, not a notification.',
].join('\n');

/**
 * Both love languages are optional, and usually at least one is missing — the
 * picker is skippable and the second person may never have opened it. So the
 * absent case is the normal path, not an edge case, and the prompt says nothing
 * about a participant it knows nothing about rather than saying "unknown".
 *
 * Values arriving here are validated even though 0006 constrains the column: a
 * row written before that constraint existed is still a row, and this is the
 * point where untrusted text would otherwise reach the model.
 */
export function buildNudgePrompt({
  mood,
  loveLanguages,
}: {
  mood: TankMood;
  loveLanguages: (string | null)[];
}): string {
  const hints = loveLanguages
    .filter(isLoveLanguage)
    .map((value) => LOVE_LANGUAGE_HINTS[value]);

  const lines = [`The tank's mood is set to "${TANK_MOOD_LABELS[mood]}".`];

  if (hints.length === 0) {
    lines.push('Nothing is known about what either person likes to receive.');
  } else if (hints.length === 1) {
    lines.push(`One of them values ${hints[0]}.`);
  } else {
    lines.push(`They value ${hints[0]} and ${hints[1]} respectively.`);
  }

  lines.push('Write the line.');
  return lines.join(' ');
}

/**
 * Model output is about to be written to a column and rendered on the *other*
 * participant's screen, so it gets treated as untrusted text.
 *
 * Returns null rather than a fallback string when there is nothing usable. A
 * generic "say hello?" would be indistinguishable from a working nudge in the
 * logs, and the whole failure mode this phase is guarding against is a job that
 * looks successful while producing nothing.
 */
export function sanitizeNudge(raw: string | undefined | null): string | null {
  if (!raw) return null;

  const text = raw
    // Collapse everything whitespace-ish: models like to return a line with a
    // trailing newline, and this is going into a single-line banner.
    .replace(/\s+/g, ' ')
    .trim()
    // Models wrap single-line answers in quotes often enough to be worth
    // stripping, and a leading quote in a banner reads as a typo.
    .replace(/^["'“”']+|["'“”']+$/g, '')
    .trim();

  if (text.length < 4) return null;
  // Truncation rather than rejection: the DB constraint is 200 and the prompt
  // asks for far less, so anything this long is a model that ignored the brief.
  // Cutting it is honest and keeps the write from failing with a 23514.
  return text.length > NUDGE_MAX_LEN ? text.slice(0, NUDGE_MAX_LEN).trim() : text;
}
