import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Issues a fire-and-forget supabase write, and says so when it fails.
 *
 * supabase-js query builders are **lazy thenables**: the HTTP request is made
 * when something awaits them, not when the chain is built. So
 *
 *     void supabase.from('t').update({ x: 1 }).eq('id', id);
 *
 * sends nothing at all — no request, no error, no console output, and a call
 * site that reads exactly like a write. Three writes in this app were dead that
 * way for two phases: the presence heartbeat, `touch_room`, and the phone-off
 * report. All three are writes whose effect is invisible from the screen that
 * makes them, which is precisely why nobody noticed.
 *
 * Anything that must not block an interaction goes through here instead of being
 * voided. `await` remains correct wherever the result is actually needed.
 *
 * Note this is only true of the PostgREST/RPC builders. `channel.send()`,
 * `removeChannel()`, and everything under `supabase.auth` return real promises
 * and are already eager, so `void` on those is fine.
 */
export function fire(
  query: PromiseLike<{ error: PostgrestError | null }>,
  label: string
): void {
  void Promise.resolve(query).then(
    ({ error }) => {
      if (error) console.warn(`[kibo] ${label} failed: ${error.message}`);
    },
    (cause: unknown) => {
      console.warn(`[kibo] ${label} threw:`, cause);
    }
  );
}
