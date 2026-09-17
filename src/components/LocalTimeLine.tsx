import { Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { isCyprusDevice, localTimeLabel } from '@/lib/cyprusTime';
import HintDot from './HintDot';

/**
 * Small line under a session time showing what that same appointment reads on
 * the client's own clock. Renders nothing for devices already on Cyprus time,
 * and nothing when the two clocks agree.
 */
interface Props {
  /** ISO date (YYYY-MM-DD) of the appointment — empty for recurring entries */
  date: string | null | undefined;
  /** Limassol HH:MM of the appointment */
  time: string | null | undefined;
  /** Attach the one-time micro-hint explaining the line */
  showHint?: boolean;
  className?: string;
}

const LocalTimeLine = ({ date, time, showHint = false, className = '' }: Props) => {
  const { lang } = useLanguage();
  if (isCyprusDevice()) return null;
  const label = localTimeLabel(date || '', time || '', lang);
  if (!label) return null;

  return (
    <span className={`relative inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 ${className}`}>
      <Globe className="w-2.5 h-2.5 shrink-0" />
      {label}
      {showHint && (
        <HintDot
          id="local_time_line"
          en="Sessions are in Limassol time — this is your clock"
          ru="Тренировки указаны по Лимассолу — здесь ваши часы"
          className="left-full -top-1 ml-2"
          side="right"
        />
      )}
    </span>
  );
};

export default LocalTimeLine;
