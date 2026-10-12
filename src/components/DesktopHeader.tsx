import { Calendar, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitch from '@/components/LanguageSwitch';
import { useLanguage } from '@/contexts/LanguageContext';

interface DesktopHeaderProps {
  active: string;
  onNavigate: (section: string) => void;
  onBook: () => void;
  onSignIn: () => void;
  showShop: boolean;
}

const DesktopHeader = ({ active, onNavigate, onBook, onSignIn, showShop }: DesktopHeaderProps) => {
  const { lang } = useLanguage();
  const links = [
    { id: 'home', label: lang === 'en' ? 'Training' : 'Тренировки' },
    { id: 'pricing', label: lang === 'en' ? 'Pricing' : 'Цены' },
    { id: 'about', label: lang === 'en' ? 'About me' : 'Обо мне' },
    ...(showShop ? [{ id: 'shop', label: lang === 'en' ? 'Shop' : 'Магазин' }] : []),
  ];
  return (
    <header className="sticky top-0 z-50 hidden shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-8 py-4 backdrop-blur-xl md:flex xl:px-14">
      <Button variant="ghost" onClick={() => onNavigate('home')} className="px-0 font-heading text-2xl hover:bg-transparent hover:text-primary">Limassol Fitness</Button>
      <nav aria-label={lang === 'en' ? 'Main navigation' : 'Основное меню'} className="flex items-center gap-1">
        {links.map(link => (
          <Button key={link.id} variant="ghost" aria-current={active === link.id ? 'location' : undefined} onClick={() => onNavigate(link.id)} className={active === link.id ? 'text-primary' : 'text-muted-foreground'}>{link.label}</Button>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitch />
        <Button variant="ghost" onClick={onSignIn} aria-label={lang === 'en' ? 'Sign In' : 'Войти'} title={lang === 'en' ? 'Sign In' : 'Войти'} size="icon"><UserRound /></Button>
        <Button onClick={onBook}><Calendar />{lang === 'en' ? 'Book a session' : 'Записаться'}</Button>
      </div>
    </header>
  );
};

export default DesktopHeader;