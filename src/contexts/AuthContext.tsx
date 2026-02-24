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
  const [isTrainer, setIsTrainer] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);
      const data = profileRes.data;
      setProfile(data ? { id: data.id, user_id: data.user_id, full_name: data.full_name, email: data.email, phone: data.phone, telegram_link_code: data.telegram_link_code, telegram_chat_id: data.telegram_chat_id } : null);
      setIsTrainer(rolesRes.data?.some((r) => r.role === 'trainer') ?? false);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    let profileFetchId = 0;
    let initialHandled = false;

    const handleSession = async (session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const currentFetchId = ++profileFetchId;
        try {
          const [profileRes, rolesRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle(),
            supabase.from('user_roles').select('role').eq('user_id', session.user.id),
          ]);
          if (currentFetchId !== profileFetchId) return;
          const data = profileRes.data;
          setProfile(data ? { id: data.id, user_id: data.user_id, full_name: data.full_name, email: data.email, phone: data.phone, telegram_link_code: data.telegram_link_code, telegram_chat_id: data.telegram_chat_id } : null);
          setIsTrainer(rolesRes.data?.some((r) => r.role === 'trainer') ?? false);
        } finally {
          if (currentFetchId === profileFetchId) setLoading(false);
        }
      } else {
        profileFetchId++;
        setProfile(null);
        setIsTrainer(false);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('[Auth] onAuthStateChange:', _event, 'hasSession:', !!session);
        if (_event === 'INITIAL_SESSION') {
          initialHandled = true;
        }
        handleSession(session);
      }
    );

    // Fallback: if INITIAL_SESSION hasn't fired yet, manually recover
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] getSession:', !!session, 'initialHandled:', initialHandled);
      if (!initialHandled) {
        handleSession(session);
      }
    });

    // Check for magic link tokens in URL
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
