import { useState, useEffect } from 'react';
import { Clock, Save, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

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
      }
      setLoaded(true);
    })();
  }, [user]);

  const toggleDayOff = (day: number) => {
    setDaysOff(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('trainer_working_hours')
      .upsert({
        trainer_user_id: user.id,
        work_start_hour: workStart,
        work_end_hour: workEnd,
        days_off: daysOff,
      }, { onConflict: 'trainer_user_id' });

    if (error) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: lang === 'en' ? 'Settings saved' : 'Настройки сохранены' });
    }
    setSaving(false);
  };

  if (!loaded) return null;

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
