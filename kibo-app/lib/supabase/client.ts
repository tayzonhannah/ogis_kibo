import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(url && anonKey);

let cached: SupabaseClient | null = null;

/**
 * Browser client, cached per tab so every component shares one realtime
 * websocket rather than opening a connection each.
 *
 * Throws loudly when env is missing, instead of surfacing as a confusing
 * "Failed to fetch" deep inside a realtime handler.
 */
export function createClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.local.example to .env.local and fill both in.'
    );
  }
  cached ??= createBrowserClient(url, anonKey);
  return cached;
}
