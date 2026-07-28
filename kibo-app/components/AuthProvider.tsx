'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';

type AuthState =
  | { status: 'loading'; userId: null; error: null }
  | { status: 'ready'; userId: string; error: null }
  | { status: 'error'; userId: null; error: string };

type AuthContextValue = AuthState & { supabase: SupabaseClient | null };

const AuthContext = createContext<AuthContextValue | null>(null);

const ENV_ERROR =
  'Supabase environment variables are missing. Copy .env.local.example to ' +
  '.env.local and fill in your project URL and anon key.';

/**
 * Signs in anonymously exactly once per tab and exposes the resulting
 * auth.uid() to the tree. Every RLS policy keys on that id, so nothing
 * touching a room may render before this resolves.
 *
 * An anonymous identity lives in local storage, so a refresh rejoins as the
 * same participant. Clearing site data mints a new one — the stale-participant
 * eviction in join_room() is what makes that recoverable.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Missing env is knowable before the first paint, so it is initial state
  // rather than an effect that immediately re-renders.
  const [state, setState] = useState<AuthState>(() =>
    hasSupabaseEnv
      ? { status: 'loading', userId: null, error: null }
      : { status: 'error', userId: null, error: ENV_ERROR }
  );
  const startedRef = useRef(false);

  useEffect(() => {
    if (!hasSupabaseEnv) return;

    // StrictMode double-invokes effects in dev; signing in twice would create
    // a second anonymous user and burn a room slot.
    if (startedRef.current) return;
    startedRef.current = true;

    const supabase = createClient();
    let active = true;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        let userId = data.session?.user.id ?? null;

        if (!userId) {
          const { data: signedIn, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          userId = signedIn.user?.id ?? null;
        }

        if (!active) return;
        if (!userId) throw new Error('Anonymous sign-in returned no user.');
        setState({ status: 'ready', userId, error: null });
      } catch (cause) {
        if (!active) return;
        const message =
          cause instanceof Error ? cause.message : 'Could not sign in.';
        setState({
          status: 'error',
          userId: null,
          error:
            message.toLowerCase().includes('anonymous')
              ? `${message} — is "Anonymous sign-ins" enabled in Supabase ` +
                '(Authentication → Providers)?'
              : message,
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, supabase: hasSupabaseEnv ? createClient() : null }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
