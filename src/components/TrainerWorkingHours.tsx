import { useState, useEffect } from 'react';
import { Clock, Save, ChevronDown, X, CalendarOff } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

interface Props {
  lang: string;
}

const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 5);

const TrainerWorkingHours = ({ lang }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const dayNames = lang === 'en' ? DAY_NAMES_EN : DAY_NAMES_RU;

  const [workStart, setWorkStart] = useState(7);
  const [workEnd, setWorkEnd] = useState(19);
  const [daysOff, setDaysOff] = useState<number[]>([0]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('trainer_working_hours')
        .select('*')
        .eq('trainer_user_id', user.id)
        .maybeSingle();
      if (data) {
        setWorkStart(data.work_start_hour);
        setWorkEnd(data.work_end_hour);
        setDaysOff(data.days_off || [0]);
        setBlockedDates(data.blocked_dates || []);
      }
      setLoaded(true);
    })();
  }, [user]);

  const toggleDayOff = (day: number) => {
    setDaysOff(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const addBlockedDate = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    if (!blockedDates.includes(dateStr)) {
      setBlockedDates(prev => [...prev, dateStr].sort());
    }
    setCalOpen(false);
  };

  const removeBlockedDate = (dateStr: string) => {
    setBlockedDates(prev => prev.filter(d => d !== dateStr));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    // Filter out past blocked dates
    const today = format(new Date(), 'yyyy-MM-dd');
    const filteredDates = blockedDates.filter(d => d >= today);

    const { error } = await supabase
      .from('trainer_working_hours')
      .upsert({
        trainer_user_id: user.id,
        work_start_hour: workStart,
        work_end_hour: workEnd,
        days_off: daysOff,
        blocked_dates: filteredDates,
      }, { onConflict: 'trainer_user_id' });

    if (error) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      setBlockedDates(filteredDates);
      toast({ title: lang === 'en' ? 'Settings saved' : 'Настройки сохранены' });
    }
    setSaving(false);
  };

  if (!loaded) return null;

  const dateLocale = lang === 'en' ? enUS : ru;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-card rounded-2xl border border-border/50">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">{lang === 'en' ? 'Working Hours' : 'Рабочие часы'}</h3>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* Time range */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[11px] text-muted-foreground mb-1 block">
                  {lang === 'en' ? 'Start' : 'Начало'}
                </label>
                <select
                  value={workStart}
                  onChange={e => setWorkStart(Number(e.target.value))}
                  className="w-full bg-secondary rounded-xl px-3 py-2 text-sm font-semibold border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {HOUR_OPTIONS.filter(h => h < workEnd).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <span className="text-muted-foreground mt-5">—</span>
              <div className="flex-1">
                <label className="text-[11px] text-muted-foreground mb-1 block">
                  {lang === 'en' ? 'End' : 'Конец'}
                </label>
                <select
                  value={workEnd}
                  onChange={e => setWorkEnd(Number(e.target.value))}
                  className="w-full bg-secondary rounded-xl px-3 py-2 text-sm font-semibold border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {HOUR_OPTIONS.filter(h => h > workStart).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Days off */}
            <div>
              <label className="text-[11px] text-muted-foreground mb-2 block">
                {lang === 'en' ? 'Days Off (no booking)' : 'Выходные (без брони)'}
              </label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6, 0].map(day => (
                  <button
                    key={day}
                    onClick={() => toggleDayOff(day)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${
                      daysOff.includes(day)
                        ? 'bg-destructive/20 text-destructive border border-destructive/30'
                        : 'bg-secondary text-foreground border border-border/50 hover:border-primary/30'
                    }`}
                  >
                    {dayNames[day]}
                  </button>
                ))}
              </div>
            </div>

            {/* Blocked specific dates */}
            <div>
              <label className="text-[11px] text-muted-foreground mb-2 block">
                {lang === 'en' ? 'Closed Dates (specific days off)' : 'Закрытые даты (конкретные выходные)'}
              </label>

              {blockedDates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {blockedDates.map(dateStr => {
                    const d = new Date(dateStr + 'T00:00:00');
                    return (
                      <span
                        key={dateStr}
                        className="inline-flex items-center gap-1 bg-destructive/15 text-destructive text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-destructive/20"
                      >
                        <CalendarOff className="w-3 h-3" />
                        {format(d, 'd MMM', { locale: dateLocale })}
                        <button
                          onClick={() => removeBlockedDate(dateStr)}
                          className="ml-0.5 hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full bg-secondary text-foreground border border-border/50 rounded-xl px-3 py-2 text-sm font-semibold hover:border-primary/30 transition-colors flex items-center justify-center gap-2">
                    <CalendarOff className="w-4 h-4 text-muted-foreground" />
                    {lang === 'en' ? 'Add closed date' : 'Добавить закрытую дату'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    onSelect={addBlockedDate}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      if (date < today) return true;
                      const dateStr = format(date, 'yyyy-MM-dd');
                      return blockedDates.includes(dateStr);
                    }}
                    locale={dateLocale}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full gradient-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving
                ? (lang === 'en' ? 'Saving...' : 'Сохранение...')
                : (lang === 'en' ? 'Save' : 'Сохранить')
              }
            </button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default TrainerWorkingHours;
