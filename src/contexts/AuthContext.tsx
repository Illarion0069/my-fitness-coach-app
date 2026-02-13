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
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setProfile(data ? { id: data.id, user_id: data.user_id, full_name: data.full_name, email: data.email, phone: data.phone, telegram_link_code: data.telegram_link_code, telegram_chat_id: data.telegram_chat_id } : null);

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    setIsTrainer(roles?.some((r) => r.role === 'trainer') ?? false);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('[Auth] onAuthStateChange:', _event, 'hasSession:', !!session);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setIsTrainer(false);
        }
        setLoading(false);
      }
    );

    // Handle PKCE code exchange (magic link redirect with ?code= parameter)
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');

    if (code) {
      console.log('[Auth] PKCE code detected, exchanging for session...');
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          console.error('[Auth] Code exchange failed:', error);
        } else {
          console.log('[Auth] Code exchange success, user:', data.user?.email);
        }
        // Clean URL
        url.searchParams.delete('code');
        window.history.replaceState(null, '', url.pathname + url.search);
      });
    } else {
      // Normal session recovery
      supabase.auth.getSession().then(({ data: { session } }) => {
        console.log('[Auth] getSession:', !!session);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        }
        setLoading(false);
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
