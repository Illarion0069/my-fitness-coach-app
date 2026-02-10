import { useLanguage } from '@/contexts/LanguageContext';

const LanguageSwitch = () => {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-0.5 bg-card rounded-xl p-0.5 border border-border/50">
      <button
        onClick={() => setLang('en')}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider transition-all duration-200 ${
          lang === 'en'
            ? 'gradient-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang('ru')}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider transition-all duration-200 ${
          lang === 'ru'
            ? 'gradient-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        RU
      </button>
    </div>
  );
};

export default LanguageSwitch;
