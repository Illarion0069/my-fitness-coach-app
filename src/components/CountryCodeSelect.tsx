import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+357', country: '🇨🇾', name: 'Cyprus' },
  { code: '+7', country: '🇷🇺', name: 'Russia' },
  { code: '+380', country: '🇺🇦', name: 'Ukraine' },
  { code: '+375', country: '🇧🇾', name: 'Belarus' },
  { code: '+1', country: '🇺🇸', name: 'USA' },
  { code: '+44', country: '🇬🇧', name: 'UK' },
  { code: '+49', country: '🇩🇪', name: 'Germany' },
  { code: '+33', country: '🇫🇷', name: 'France' },
  { code: '+39', country: '🇮🇹', name: 'Italy' },
  { code: '+34', country: '🇪🇸', name: 'Spain' },
  { code: '+30', country: '🇬🇷', name: 'Greece' },
  { code: '+90', country: '🇹🇷', name: 'Turkey' },
  { code: '+972', country: '🇮🇱', name: 'Israel' },
  { code: '+971', country: '🇦🇪', name: 'UAE' },
  { code: '+374', country: '🇦🇲', name: 'Armenia' },
  { code: '+995', country: '🇬🇪', name: 'Georgia' },
  { code: '+370', country: '🇱🇹', name: 'Lithuania' },
  { code: '+371', country: '🇱🇻', name: 'Latvia' },
  { code: '+372', country: '🇪🇪', name: 'Estonia' },
  { code: '+48', country: '🇵🇱', name: 'Poland' },
  { code: '+420', country: '🇨🇿', name: 'Czechia' },
  { code: '+40', country: '🇷🇴', name: 'Romania' },
  { code: '+359', country: '🇧🇬', name: 'Bulgaria' },
  { code: '+381', country: '🇷🇸', name: 'Serbia' },
  { code: '+385', country: '🇭🇷', name: 'Croatia' },
  { code: '+36', country: '🇭🇺', name: 'Hungary' },
  { code: '+43', country: '🇦🇹', name: 'Austria' },
  { code: '+41', country: '🇨🇭', name: 'Switzerland' },
  { code: '+46', country: '🇸🇪', name: 'Sweden' },
  { code: '+47', country: '🇳🇴', name: 'Norway' },
  { code: '+45', country: '🇩🇰', name: 'Denmark' },
  { code: '+358', country: '🇫🇮', name: 'Finland' },
  { code: '+351', country: '🇵🇹', name: 'Portugal' },
  { code: '+31', country: '🇳🇱', name: 'Netherlands' },
  { code: '+32', country: '🇧🇪', name: 'Belgium' },
  { code: '+61', country: '🇦🇺', name: 'Australia' },
  { code: '+64', country: '🇳🇿', name: 'New Zealand' },
  { code: '+81', country: '🇯🇵', name: 'Japan' },
  { code: '+82', country: '🇰🇷', name: 'South Korea' },
  { code: '+86', country: '🇨🇳', name: 'China' },
  { code: '+91', country: '🇮🇳', name: 'India' },
  { code: '+55', country: '🇧🇷', name: 'Brazil' },
  { code: '+52', country: '🇲🇽', name: 'Mexico' },
  { code: '+27', country: '🇿🇦', name: 'South Africa' },
  { code: '+234', country: '🇳🇬', name: 'Nigeria' },
  { code: '+254', country: '🇰🇪', name: 'Kenya' },
  { code: '+20', country: '🇪🇬', name: 'Egypt' },
  { code: '+966', country: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+65', country: '🇸🇬', name: 'Singapore' },
  { code: '+60', country: '🇲🇾', name: 'Malaysia' },
  { code: '+66', country: '🇹🇭', name: 'Thailand' },
  { code: '+84', country: '🇻🇳', name: 'Vietnam' },
  { code: '+62', country: '🇮🇩', name: 'Indonesia' },
  { code: '+63', country: '🇵🇭', name: 'Philippines' },
  { code: '+998', country: '🇺🇿', name: 'Uzbekistan' },
  { code: '+7', country: '🇰🇿', name: 'Kazakhstan' },
  { code: '+992', country: '🇹🇯', name: 'Tajikistan' },
  { code: '+996', country: '🇰🇬', name: 'Kyrgyzstan' },
  { code: '+993', country: '🇹🇲', name: 'Turkmenistan' },
  { code: '+994', country: '🇦🇿', name: 'Azerbaijan' },
  { code: '+373', country: '🇲🇩', name: 'Moldova' },
];

interface CountryCodeSelectProps {
  value: string;
  onChange: (code: string) => void;
  phoneNumber: string;
  onPhoneChange: (num: string) => void;
  placeholder?: string;
}

const CountryCodeSelect = ({ value, onChange, phoneNumber, onPhoneChange, placeholder }: CountryCodeSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = COUNTRY_CODES.find(c => c.code === value && c.country);
  const filtered = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search) ||
    c.country.includes(search)
  );

  return (
    <div className="flex gap-2" ref={ref}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 bg-secondary/50 border border-border/50 rounded-xl px-3 py-3 text-sm hover:bg-secondary transition-colors min-w-[90px]"
        >
          <span>{selected?.country || '🌍'}</span>
          <span className="text-xs">{value}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-[110] w-64 max-h-52 overflow-hidden">
            <div className="p-2 border-b border-border/50">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto max-h-40">
              {filtered.map((c, i) => (
                <button
                  key={`${c.code}-${c.name}-${i}`}
                  type="button"
                  onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary/80 transition-colors text-left"
                >
                  <span>{c.country}</span>
                  <span className="text-muted-foreground">{c.code}</span>
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <input
        type="tel"
        placeholder={placeholder || 'Phone number'}
        value={phoneNumber}
        onChange={e => {
          const val = e.target.value.replace(/[^\d]/g, '');
          onPhoneChange(val);
        }}
        className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        maxLength={15}
      />
    </div>
  );
};

export default CountryCodeSelect;
