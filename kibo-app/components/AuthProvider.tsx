'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';
import type { ProfileRow, UserProfile } from '@/lib/types';

export type AuthStatus = 'loading' | 'ready' | 'unauthenticated' | 'error';

export type AuthState =
  | {
      status: 'loading';
      user: null;
      profile: null;
      userId: null;
      session: null;
      error: null;
    }
  | {
      status: 'ready';
      user: UserProfile;
      profile: UserProfile;
      userId: string;
      session: Session;
      error: null;
    }
  | {
      status: 'unauthenticated';
      user: null;
      profile: null;
      userId: null;
      session: null;
      error: null;
    }
  | {
      status: 'error';
      user: null;
      profile: null;
      userId: null;
      session: null;
      error: string;
    };

export type AuthContextValue = AuthState & {
  supabase: SupabaseClient | null;
  signInWithGoogle: () => Promise<void>;
  signInAsDemoUser: (displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ENV_ERROR =
  'Supabase environment variables are missing. Copy .env.local.example to ' +
  '.env.local and fill in your project URL and anon key.';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    hasSupabaseEnv
      ? {
          status: 'loading',
          user: null,
          profile: null,
          userId: null,
          session: null,
          error: null,
        }
      : {
          status: 'error',
          user: null,
          profile: null,
          userId: null,
          session: null,
          error: ENV_ERROR,
        }
  );

  const fetchProfileForUser = useCallback(
    async (supabase: SupabaseClient, session: Session): Promise<UserProfile> => {
      const u = session.user;
      const meta = u.user_metadata ?? {};
      const fallbackName =
        meta.full_name || meta.name || (u.email ? u.email.split('@')[0] : 'Aquanaut');
      const fallbackAvatar = meta.avatar_url || meta.picture || undefined;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, display_name, avatar_url, fish_points, created_at, updated_at')
          .eq('id', u.id)
          .single();

        if (error || !data) {
          return {
            id: u.id,
            email: u.email ?? undefined,
            displayName: fallbackName,
            avatarUrl: fallbackAvatar,
            fishPoints: 0,
          };
        }

        const profileRow = data as ProfileRow;
        return {
          id: profileRow.id,
          email: profileRow.email ?? u.email ?? undefined,
          displayName: profileRow.display_name || fallbackName,
          avatarUrl: profileRow.avatar_url || fallbackAvatar,
          fishPoints: profileRow.fish_points ?? 0,
          createdAt: profileRow.created_at,
          updatedAt: profileRow.updated_at,
        };
      } catch {
        return {
          id: u.id,
          email: u.email ?? undefined,
          displayName: fallbackName,
          avatarUrl: fallbackAvatar,
          fishPoints: 0,
        };
      }
    },
    []
  );

  const syncSession = useCallback(
    async (supabase: SupabaseClient, session: Session | null) => {
      if (!session || !session.user) {
        setState({
          status: 'unauthenticated',
          user: null,
          profile: null,
          userId: null,
          session: null,
          error: null,
        });
        return;
      }

      try {
        const profile = await fetchProfileForUser(supabase, session);
        setState({
          status: 'ready',
          user: profile,
          profile,
          userId: session.user.id,
          session,
          error: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to synchronize profile.';
        setState({
          status: 'error',
          user: null,
          profile: null,
          userId: null,
          session: null,
          error: message,
        });
      }
    },
    [fetchProfileForUser]
  );

  useEffect(() => {
    if (!hasSupabaseEnv) return;

    const supabase = createClient();

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        await syncSession(supabase, data.session);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not fetch auth session.';
        setState({
          status: 'error',
          user: null,
          profile: null,
          userId: null,
          session: null,
          error: message,
        });
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(supabase, session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [syncSession]);

  const signInWithGoogle = useCallback(async () => {
    if (!hasSupabaseEnv) throw new Error(ENV_ERROR);
    const supabase = createClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) throw error;
  }, []);

  const signInAsDemoUser = useCallback(async (displayName: string) => {
    if (!hasSupabaseEnv) throw new Error(ENV_ERROR);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInAnonymously({
      options: {
        data: { full_name: displayName, name: displayName }
      }
    });
    if (error) throw error;
    if (data.session) {
      await syncSession(supabase, data.session);
    }
  }, [syncSession]);

  const signOut = useCallback(async () => {
    if (!hasSupabaseEnv) return;
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign out error:', error);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!hasSupabaseEnv) return;
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    await syncSession(supabase, data.session);
  }, [syncSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      supabase: hasSupabaseEnv ? createClient() : null,
      signInWithGoogle,
      signInAsDemoUser,
      signOut,
      refreshProfile,
    }),
    [state, signInWithGoogle, signInAsDemoUser, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
