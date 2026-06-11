import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Language } from '@/i18n/translations';
import { supabase } from '@/integrations/supabase/client';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (obj: { en: string; ru: string }) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (obj) => obj.en,
});

const STORAGE_KEY = 'app_lang';

const readInitialLang = (): Language => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'ru') return v;
  } catch {}
  return 'en';
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(readInitialLang);
  const loadedFromProfile = useRef(false);

  // On auth, hydrate from profile.preferred_language if present.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const pref = (data as any)?.preferred_language;
      if (pref === 'en' || pref === 'ru') {
        loadedFromProfile.current = true;
        setLangState(pref);
        try { localStorage.setItem(STORAGE_KEY, pref); } catch {}
      }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const setLang = (next: Language) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    // Persist to profile (best-effort)
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ preferred_language: next }).eq('user_id', user.id);
    })();
  };

  const t = (obj: { en: string; ru: string }) => obj[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
