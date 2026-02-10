import { useLanguage } from '@/contexts/LanguageContext';

const LanguageSwitch = () => {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-px border border-border">
      <button
        onClick={() => setLang('en')}
        className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] transition-all duration-300 ${
          lang === 'en'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang('ru')}
        className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] transition-all duration-300 ${
          lang === 'ru'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        RU
      </button>
    </div>
  );
};

export default LanguageSwitch;