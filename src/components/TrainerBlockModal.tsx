import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Ban, Calendar as CalIcon, RotateCcw, Car, UserPlus } from 'lucide-react';

interface ClientProfile {
  user_id: string;
  full_name: string;
}

interface Props {
  lang: string;
  hour: number;
  date: string;
  dayOfWeek: number;
  clients: ClientProfile[];
  onClose: () => void;
  onSaveBlock: (block: {
    block_type: string;
    title: string | null;
    block_time: string;
    duration_minutes: number;
    is_recurring: boolean;
    recurrence_day: number | null;
    block_date: string | null;
  }) => void;
  onAddSession: (opts: {
    clientId: string;
    manualName: string;
    time: string;
    travelMinutes: number;
    isRecurring: boolean;
    recurrenceDay: number | null;
  }) => void;
}

const BLOCK_TYPES = [
  { type: 'session', icon: CalIcon, labelRu: 'Тренировка', labelEn: 'Session', color: 'bg-primary/15 text-primary' },
  { type: 'reload', icon: CalIcon, labelRu: 'Reload (групповой)', labelEn: 'Reload (group)', color: 'bg-teal-500/15 text-teal-600' },
  { type: 'block', icon: Ban, labelRu: 'Закрыть слот', labelEn: 'Block slot', color: 'bg-destructive/15 text-destructive' },
  { type: 'personal', icon: CalIcon, labelRu: 'Личное событие', labelEn: 'Personal event', color: 'bg-blue-500/15 text-blue-600' },
];

const TrainerBlockModal = ({ lang, hour, date, dayOfWeek, clients, onClose, onSaveBlock, onAddSession }: Props) => {
  const [step, setStep] = useState<'choose' | 'session' | 'block'>('choose');
  const [blockType, setBlockType] = useState('block');

  // Session fields
  const [selectedClientId, setSelectedClientId] = useState('');
  const [manualName, setManualName] = useState('');
  const [useManualName, setUseManualName] = useState(false);
  const [sessionTime, setSessionTime] = useState(`${String(hour).padStart(2, '0')}:00`);
  const [travelMinutes, setTravelMinutes] = useState(0);
  const [sessionRecurring, setSessionRecurring] = useState(false);

  // Block fields
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(`${String(hour).padStart(2, '0')}:00`);
  const [duration, setDuration] = useState(60);
  const [isRecurring, setIsRecurring] = useState(false);

  const handleTypeSelect = (type: string) => {
    if (type === 'session') {
      setStep('session');
      return;
    }
    setBlockType(type);
    if (type === 'reload') {
      setTitle('Reload');
    } else if (type === 'personal') {
      setTitle('');
    } else {
      setTitle(lang === 'en' ? 'Blocked' : 'Закрыто');
    }
    setStep('block');
  };

  const handleSaveBlock = () => {
    onSaveBlock({
      block_type: blockType,
      title: title || null,
      block_time: startTime,
      duration_minutes: duration,
      is_recurring: isRecurring,
      recurrence_day: isRecurring ? dayOfWeek : null,
      block_date: isRecurring ? null : date,
    });
  };

  const handleSaveSession = () => {
    onAddSession({
      clientId: useManualName ? '' : selectedClientId,
      manualName: useManualName ? manualName.trim() : '',
      time: sessionTime,
      travelMinutes,
      isRecurring: sessionRecurring,
      recurrenceDay: sessionRecurring ? dayOfWeek : null,
    });
  };

  const canSaveSession = useManualName ? manualName.trim().length > 0 : selectedClientId.length > 0;

  const dayNames = lang === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  return createPortal(
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

        {/* Step 1: Choose type */}
        {step === 'choose' && (
          <div className="px-5 space-y-3">
            <p className="text-sm font-bold text-center">
              {`${String(hour).padStart(2, '0')}:00`}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {BLOCK_TYPES.map(bt => {
                const Icon = bt.icon;
                return (
                  <button
                    key={bt.type}
                    onClick={() => handleTypeSelect(bt.type)}
                    className={`flex flex-col items-center gap-1.5 ${bt.color} rounded-xl px-3 py-3.5 text-center transition-all active:scale-95`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px] font-semibold leading-tight">{lang === 'en' ? bt.labelEn : bt.labelRu}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2a: Session form */}
        {step === 'session' && (
          <div className="px-5 space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setStep('choose')} className="text-muted-foreground text-xs">
                ← {lang === 'en' ? 'Back' : 'Назад'}
              </button>
              <p className="text-sm font-bold">{lang === 'en' ? 'New session' : 'Новая тренировка'}</p>
              <button onClick={onClose} className="text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            {/* Client selection */}
            {!useManualName ? (
              <div className="space-y-1.5">
                <select
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                >
                  <option value="">{lang === 'en' ? 'Select client' : 'Выберите клиента'}</option>
                  {clients.map(c => (
                    <option key={c.user_id} value={c.user_id}>{c.full_name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setUseManualName(true)}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Enter name manually' : 'Ввести имя вручную'}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder={lang === 'en' ? 'Client name' : 'Имя клиента'}
                  autoFocus
                  className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
                <button
                  onClick={() => { setUseManualName(false); setManualName(''); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← {lang === 'en' ? 'Pick from list' : 'Выбрать из списка'}
                </button>
              </div>
            )}

            {/* Time */}
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium">
                {lang === 'en' ? 'Time' : 'Время'}
              </label>
              <input
                type="time"
                value={sessionTime}
                onChange={e => setSessionTime(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              />
            </div>

            {/* Travel time option */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Car className="w-3 h-3" />
                {lang === 'en' ? 'Travel time before session' : 'Время в пути до тренировки'}
              </label>
              <div className="flex gap-1.5">
                {[
                  { value: 0, label: lang === 'en' ? 'None' : 'Нет' },
                  { value: 30, label: '30 мин' },
                  { value: 60, label: '1 час' },
                  { value: 90, label: '1.5 ч' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTravelMinutes(opt.value)}
                    className={`flex-1 text-xs font-medium py-2 rounded-lg transition-colors ${
                      travelMinutes === opt.value
                        ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                        : 'bg-secondary/50 text-muted-foreground border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {travelMinutes > 0 && (
                <p className="text-[10px] text-amber-500/80">
                  {lang === 'en'
                    ? `Slot at ${computeTravelTime(sessionTime, travelMinutes)} will be blocked for travel`
                    : `Слот в ${computeTravelTime(sessionTime, travelMinutes)} будет закрыт на дорогу`}
                </p>
              )}
            </div>

            {/* Recurring toggle */}
            <button
              onClick={() => setSessionRecurring(!sessionRecurring)}
              className={`flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-sm transition-colors ${
                sessionRecurring ? 'bg-primary/10 text-primary' : 'bg-secondary/50 text-muted-foreground'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="font-medium text-xs">
                {sessionRecurring
                  ? (lang === 'en' ? `Every ${dayNames[dayOfWeek]}` : `Каждый ${dayNames[dayOfWeek]}`)
                  : (lang === 'en' ? 'One-time' : 'Разовая')}
              </span>
            </button>

            {/* Save */}
            <button
              onClick={handleSaveSession}
              disabled={!canSaveSession}
              className="w-full gradient-primary text-primary-foreground text-sm font-bold py-3 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {lang === 'en' ? 'Add session' : 'Добавить тренировку'}
            </button>
          </div>
        )}

        {/* Step 2b: Block/Personal event form */}
        {step === 'block' && (
          <div className="px-5 space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setStep('choose')} className="text-muted-foreground text-xs">
                ← {lang === 'en' ? 'Back' : 'Назад'}
              </button>
              <p className="text-sm font-bold">
                {blockType === 'block' ? (lang === 'en' ? 'Block slot' : 'Закрыть слот') :
                 (lang === 'en' ? 'Personal event' : 'Личное событие')}
              </p>
              <button onClick={onClose} className="text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

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

            <button
              onClick={handleSaveBlock}
              disabled={blockType === 'personal' && !title.trim()}
              className="w-full gradient-primary text-primary-foreground text-sm font-bold py-3 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {lang === 'en' ? 'Save' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

function computeTravelTime(sessionTime: string, travelMinutes: number): string {
  const [h, m] = sessionTime.split(':').map(Number);
  const totalMin = h * 60 + (m || 0) - travelMinutes;
  const th = Math.max(0, Math.floor(totalMin / 60));
  const tm = totalMin % 60;
  return `${String(th).padStart(2, '0')}:${String(tm < 0 ? 0 : tm).padStart(2, '0')}`;
}

export default TrainerBlockModal;
