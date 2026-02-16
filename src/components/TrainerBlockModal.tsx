import { useState } from 'react';
import { X, Ban, Car, Calendar as CalIcon, RotateCcw } from 'lucide-react';

interface Props {
  lang: string;
  hour: number;
  date: string;
  dayOfWeek: number;
  onClose: () => void;
  onSave: (block: {
    block_type: string;
    title: string | null;
    block_time: string;
    duration_minutes: number;
    is_recurring: boolean;
    recurrence_day: number | null;
    block_date: string | null;
  }) => void;
  onAddSession: () => void;
}

const BLOCK_TYPES = [
  { type: 'session', icon: CalIcon, labelRu: 'Тренировка', labelEn: 'Session', color: 'bg-primary/15 text-primary' },
  { type: 'block', icon: Ban, labelRu: 'Закрыть слот', labelEn: 'Block slot', color: 'bg-destructive/15 text-destructive' },
  { type: 'travel', icon: Car, labelRu: 'Время в пути', labelEn: 'Travel time', color: 'bg-amber-500/15 text-amber-600' },
  { type: 'personal', icon: CalIcon, labelRu: 'Личное событие', labelEn: 'Personal event', color: 'bg-blue-500/15 text-blue-600' },
];

const TrainerBlockModal = ({ lang, hour, date, dayOfWeek, onClose, onSave, onAddSession }: Props) => {
  const [step, setStep] = useState<'choose' | 'details'>('choose');
  const [blockType, setBlockType] = useState('block');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(`${String(hour).padStart(2, '0')}:00`);
  const [duration, setDuration] = useState(60);
  const [isRecurring, setIsRecurring] = useState(false);

  const handleTypeSelect = (type: string) => {
    if (type === 'session') {
      onAddSession();
      return;
    }
    setBlockType(type);
    if (type === 'travel') {
      setTitle(lang === 'en' ? 'Travel' : 'В пути');
      setDuration(60);
    } else if (type === 'personal') {
      setTitle('');
    } else {
      setTitle(lang === 'en' ? 'Blocked' : 'Закрыто');
    }
    setStep('details');
  };

  const handleSave = () => {
    onSave({
      block_type: blockType,
      title: title || null,
      block_time: startTime,
      duration_minutes: duration,
      is_recurring: isRecurring,
      recurrence_day: isRecurring ? dayOfWeek : null,
      block_date: isRecurring ? null : date,
    });
  };

  const dayNames = lang === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border/50 rounded-t-2xl w-full max-w-md shadow-xl animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-3">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {step === 'choose' ? (
          <div className="px-5 space-y-3">
            <p className="text-sm font-bold text-center">
              {`${String(hour).padStart(2, '0')}:00`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {BLOCK_TYPES.map(bt => {
                const Icon = bt.icon;
                return (
                  <button
                    key={bt.type}
                    onClick={() => handleTypeSelect(bt.type)}
                    className={`flex items-center gap-2.5 ${bt.color} rounded-xl px-4 py-3.5 text-left transition-all active:scale-95`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="text-xs font-semibold">{lang === 'en' ? bt.labelEn : bt.labelRu}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-5 space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setStep('choose')} className="text-muted-foreground text-xs">
                ← {lang === 'en' ? 'Back' : 'Назад'}
              </button>
              <p className="text-sm font-bold">
                {blockType === 'block' ? (lang === 'en' ? 'Block slot' : 'Закрыть слот') :
                 blockType === 'travel' ? (lang === 'en' ? 'Travel time' : 'Время в пути') :
                 (lang === 'en' ? 'Personal event' : 'Личное событие')}
              </p>
              <button onClick={onClose} className="text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title input (for personal events) */}
            {blockType === 'personal' && (
              <input
                type="text"
                placeholder={lang === 'en' ? 'Event name (e.g. Reload)' : 'Название (напр. Reload)'}
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
              />
            )}

            {/* Time */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium">
                  {lang === 'en' ? 'Start time' : 'Время начала'}
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium">
                  {lang === 'en' ? 'Duration' : 'Длительность'}
                </label>
                <select
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                >
                  <option value={30}>30 {lang === 'en' ? 'min' : 'мин'}</option>
                  <option value={60}>1 {lang === 'en' ? 'hour' : 'час'}</option>
                  <option value={90}>1.5 {lang === 'en' ? 'hours' : 'часа'}</option>
                  <option value={120}>2 {lang === 'en' ? 'hours' : 'часа'}</option>
                  <option value={180}>3 {lang === 'en' ? 'hours' : 'часа'}</option>
                </select>
              </div>
            </div>

            {/* Recurring toggle */}
            <button
              onClick={() => setIsRecurring(!isRecurring)}
              className={`flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isRecurring ? 'bg-primary/10 text-primary' : 'bg-secondary/50 text-muted-foreground'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="font-medium text-xs">
                {isRecurring
                  ? (lang === 'en' ? `Every ${dayNames[dayOfWeek]}` : `Каждый ${dayNames[dayOfWeek]}`)
                  : (lang === 'en' ? 'One-time' : 'Разовое')}
              </span>
            </button>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={blockType === 'personal' && !title.trim()}
              className="w-full gradient-primary text-primary-foreground text-sm font-bold py-3 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {lang === 'en' ? 'Save' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerBlockModal;
