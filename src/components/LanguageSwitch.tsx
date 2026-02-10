import { useLanguage } from '@/contexts/LanguageContext';

const LanguageSwitch = () => {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-1 glass rounded-full p-1">
      <button
        onClick={() => setLang('en')}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
          lang === 'en'
            ? 'gradient-primary text-primary-foreground shadow-lg'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang('ru')}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
          lang === 'ru'
            ? 'gradient-primary text-primary-foreground shadow-lg'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        RU
      </button>
    </div>
  );
};

export default LanguageSwitch;
