import { Home, ClipboardCheck, CreditCard, Star, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';

interface BottomNavProps {
  active: string;
  onNavigate: (section: string) => void;
}

const BottomNav = ({ active, onNavigate }: BottomNavProps) => {
  const { t } = useLanguage();
  const nav = translations.nav;

  const items = [
    { id: 'home', icon: Home, label: t(nav.home) },
    { id: 'test', icon: ClipboardCheck, label: t(nav.test) },
    { id: 'pricing', icon: CreditCard, label: t(nav.pricing) },
    { id: 'reviews', icon: Star, label: t(nav.reviews) },
    { id: 'contact', icon: MessageCircle, label: t(nav.contact) },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-2xl border-t border-border/30 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-300 ${
              active === item.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <item.icon className={`w-5 h-5 ${active === item.id ? 'drop-shadow-[0_0_8px_hsl(16,90%,55%,0.5)]' : ''}`} />
            <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
