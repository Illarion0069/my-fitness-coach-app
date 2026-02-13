import { Home, ClipboardCheck, CreditCard, User, MessageCircle, Users, Shield } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';

interface BottomNavProps {
  active: string;
  onNavigate: (section: string) => void;
  showGroup?: boolean;
  showAdmin?: boolean;
}

const BottomNav = ({ active, onNavigate, showGroup = false, showAdmin = false }: BottomNavProps) => {
  const { t, lang } = useLanguage();
  const nav = translations.nav;

  const items = [
    { id: 'home', icon: Home, label: t(nav.home) },
    { id: 'test', icon: ClipboardCheck, label: t(nav.test) },
    { id: 'pricing', icon: CreditCard, label: t(nav.pricing) },
    ...(showGroup ? [{ id: 'group', icon: Users, label: t(nav.group) }] : []),
    { id: 'about', icon: User, label: lang === 'en' ? 'About' : 'Обо мне' },
    { id: 'contact', icon: MessageCircle, label: t(nav.contact) },
    ...(showAdmin ? [{ id: 'admin', icon: Shield, label: lang === 'en' ? 'Admin' : 'Админ' }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-2xl border-t border-border/50 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
              active === item.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="relative">
              <item.icon className="w-5 h-5" />
              {active === item.id && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </div>
            <span className="text-[10px] font-semibold">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
