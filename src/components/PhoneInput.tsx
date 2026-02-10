import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CountryCode {
  code: string;
  country: string;
  label: string;
}

interface PhoneInputProps {
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  countryCodes: CountryCode[];
}

const PhoneInput = ({ countryCode, onCountryCodeChange, phone, onPhoneChange, countryCodes }: PhoneInputProps) => {
  const [open, setOpen] = useState(false);
  const selected = countryCodes.find(c => c.code === countryCode) || countryCodes[0];

  return (
    <div className="relative">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="glass flex items-center gap-1.5 px-3 py-2 rounded-md border border-input text-sm min-w-[100px] justify-between"
        >
          <span>{selected.country} {selected.code}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="95144819"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm glass"
        />
      </div>

      {open && (
        <div className="absolute z-50 top-12 left-0 w-56 glass rounded-xl border border-border shadow-xl max-h-48 overflow-y-auto">
          {countryCodes.map((c) => (
            <button
              key={c.code}
              onClick={() => { onCountryCodeChange(c.code); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-primary/10 transition-colors ${
                c.code === countryCode ? 'text-primary font-medium' : 'text-foreground'
              }`}
            >
              <span>{c.country}</span>
              <span className="font-mono">{c.code}</span>
              <span className="text-muted-foreground text-xs ml-auto">{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhoneInput;
