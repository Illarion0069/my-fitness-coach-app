import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  telegram_link_code: string | null;
  telegram_chat_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isTrainer: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isTrainer, setIsTrainer] = useState(() => localStorage.getItem('user_role_hint') === 'trainer');
  const [loading, setLoading] = useState(true);

  const applyProfileState = (profileData: any, rolesData: Array<{ role: string }> | null) => {
    setProfile(profileData ? {
      id: profileData.id,
      user_id: profileData.user_id,
      full_name: profileData.full_name,
      email: profileData.email,
      phone: profileData.phone,
      telegram_link_code: profileData.telegram_link_code,
      telegram_chat_id: profileData.telegram_chat_id,
    } : null);

    const trainer = rolesData?.some((role) => role.role === 'trainer') ?? false;
    setIsTrainer(trainer);
    localStorage.setItem('user_role_hint', trainer ? 'trainer' : 'client');
  };

  const fetchProfile = async (userId: string, opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);

      applyProfileState(profileRes.data, (rolesRes.data as Array<{ role: string }> | null) ?? null);
    } finally {
      if (!opts.silent) setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, { silent: true });
  };

  useEffect(() => {
    let profileFetchId = 0;
    let initialHandled = false;

    const handleSession = async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const currentFetchId = ++profileFetchId;
        setLoading(true);
        setIsTrainer(localStorage.getItem('user_role_hint') === 'trainer');

        try {
          const [profileRes, rolesRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('user_id', nextSession.user.id).maybeSingle(),
            supabase.from('user_roles').select('role').eq('user_id', nextSession.user.id),
          ]);

          if (currentFetchId !== profileFetchId) return;
          applyProfileState(profileRes.data, (rolesRes.data as Array<{ role: string }> | null) ?? null);

          // Fire-and-forget: notify trainer about new signup (idempotent server-side)
          if (!(profileRes.data as any)?.signup_notified_at) {
            supabase.functions.invoke('notify-signup').catch((err) => {
              console.warn('[Auth] notify-signup failed:', err);
            });
          }
        } finally {
          if (currentFetchId === profileFetchId) setLoading(false);
        }
      } else {
        profileFetchId++;
        setProfile(null);
        setIsTrainer(false);
        localStorage.removeItem('user_role_hint');
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        console.log('[Auth] onAuthStateChange:', _event, 'hasSession:', !!nextSession);
        if (_event === 'INITIAL_SESSION') {
          initialHandled = true;
        }
        handleSession(nextSession);
      }
    );

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      console.log('[Auth] getSession:', !!nextSession, 'initialHandled:', initialHandled);
      if (!initialHandled) {
        handleSession(nextSession);
      }
    });

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (accessToken && refreshToken) {
      console.log('[Auth] Implicit flow tokens detected in URL hash');
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        if (error) console.error('[Auth] setSession failed:', error);
        window.history.replaceState(null, '', window.location.pathname);
      });
    } else if (code) {
      console.log('[Auth] PKCE code detected in URL');
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) console.error('[Auth] Code exchange failed:', error);
        url.searchParams.delete('code');
        window.history.replaceState(null, '', url.pathname + url.search);
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user_role_hint');
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsTrainer(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isTrainer, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
