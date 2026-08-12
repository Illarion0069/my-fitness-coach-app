import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

declare global {
  interface Window {
    __appReady?: boolean;
  }
}

const ConnectionSplash = () => {
  const { t } = useLanguage();

  useEffect(() => {
    const splash = document.getElementById('splash');
    const textEl = document.getElementById('splash-text');
    if (!splash || !textEl) return;

    const show = (message: string) => {
      textEl.textContent = message;
      splash.classList.add('show');
    };
    const hide = () => {
      splash.classList.remove('show');
    };

    window.__appReady = true;

    const onOffline = () =>
      show(
        t({
          en: 'Bad connection. Trying to connect…',
          ru: 'Плохое соединение. Пытаемся подключиться…',
        })
      );
    const onOnline = () => {
      if (navigator.onLine) hide();
    };

    if (navigator.onLine) {
      hide();
    } else {
      onOffline();
    }

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [t]);

  return null;
};

export default ConnectionSplash;
