import { MessageCircle, Phone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';

const FloatingContactButton = () => {
  const { lang } = useLanguage();
  const label = lang === 'en' ? 'Contact Illarion' : 'Связаться с Илларионом';

  return (
    <div className="fixed bottom-8 right-6 z-40 hidden md:block lg:right-8">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            aria-label={label}
            title={label}
            data-track="Floating contact: open"
            className="h-14 w-14 rounded-full shadow-lg ring-4 ring-primary/20 transition-transform hover:scale-105 motion-reduce:transition-none [&_svg]:size-6"
          >
            <Phone />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" sideOffset={12} className="w-64 space-y-3">
          <h2 className="font-heading text-2xl">{label}</h2>
          <Button asChild className="w-full justify-start gap-3">
            <a href="https://wa.me/35795144819" target="_blank" rel="noopener noreferrer" data-track="Floating contact: WhatsApp">
              <MessageCircle /> WhatsApp
            </a>
          </Button>
          <Button asChild variant="secondary" className="w-full justify-start gap-3">
            <a href="https://t.me/fitnesslimassol" target="_blank" rel="noopener noreferrer" data-track="Floating contact: Telegram">
              <Send /> Telegram
            </a>
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default FloatingContactButton;