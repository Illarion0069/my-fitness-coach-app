import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Package, CalendarDays, Ruler, Activity, ClipboardCheck, Send, Plus, Minus, Trash2, Save, KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ClientSchedule from './ClientSchedule';
import TrainerWhoopWidget from './TrainerWhoopWidget';
import ClientTestHistory from './ClientTestHistory';
import BodyMeasurementsInput from './BodyMeasurementsInput';
import BodyMeasurementsView from './BodyMeasurementsView';

interface ClientPackage {
  id: string;
  user_id: string;
  package_name: string;
  total_sessions: number;
  used_sessions: number;
  is_active: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
}

interface AccordionSectionProps {
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string | number;
}

const AccordionSection = ({ icon, title, isOpen, onToggle, children, badge }: AccordionSectionProps) => (
  <div className="border border-border/30 rounded-xl overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2.5 px-3.5 py-3 hover:bg-secondary/30 transition-colors"
    >
      {icon}
      <span className="text-xs font-semibold flex-1 text-left">{title}</span>
      {badge != null && (
        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-md font-bold">{badge}</span>
      )}
      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="px-3.5 pb-3.5">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

interface Props {
  client: Profile;
  clientPkgs: ClientPackage[];
  lang: string;
  onSessionChange: () => void;
  onAddSession: (pkgId: string, delta: number) => void;
  onDeletePackage: (pkgId: string) => void;
  onCreatePackage: (userId: string, sessions: number) => void;
  onSendRemaining: () => void;
  onSendRenewal: () => void;
  onDeleteClient?: () => void;
}

const ClientDetailAccordion = ({
  client,
  clientPkgs,
  lang,
  onSessionChange,
  onAddSession,
  onDeletePackage,
  onCreatePackage,
  onSendRemaining,
  onSendRenewal,
  onDeleteClient,
}: Props) => {
  const { toast } = useToast();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [newPkgName, setNewPkgName] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);

  const toggleSection = (id: string) => setOpenSection(prev => prev === id ? null : id);

  const handleCreatePackage = () => {
    const parsed = parseInt(newPkgName.trim(), 10);
    if (!parsed || parsed <= 0) {
      toast({ title: lang === 'en' ? 'Enter a number' : 'Введите число', variant: 'destructive' });
      return;
    }
    onCreatePackage(client.user_id, parsed);
    setNewPkgName('');
  };

  const handleResetPassword = async () => {
    if (resetPw.length < 6) {
      toast({ title: lang === 'en' ? 'Min 6 characters' : 'Минимум 6 символов', variant: 'destructive' });
      return;
    }
    setResettingPw(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { action: 'trainer_reset', client_user_id: client.user_id, new_password: resetPw },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: lang === 'en' ? 'Password updated' : 'Пароль обновлён' });
      setResetPw('');
      setShowResetPw(false);
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: e.message, variant: 'destructive' });
    }
    setResettingPw(false);
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="px-4 pb-4 space-y-2 border-t border-border/30"
    >
      {/* Contact info — always visible compact row */}
      <div className="bg-secondary/30 rounded-xl p-3 mt-3 space-y-1.5">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
          {lang === 'en' ? 'Contact Info' : 'Контакты'}
        </p>
        <p className="text-xs text-foreground">{client.full_name}</p>
        <p className="text-xs text-muted-foreground">{client.email}</p>
        {client.phone ? (
          <p className="text-xs text-muted-foreground">{client.phone}</p>
        ) : (
          <div className="flex gap-2 items-center">
            <input
              type="tel"
              placeholder={lang === 'en' ? 'Enter phone' : 'Введите телефон'}
              className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (!val) return;
                  await supabase.from('profiles').update({ phone: val }).eq('user_id', client.user_id);
                  onSessionChange();
                  toast({ title: lang === 'en' ? 'Phone saved' : 'Телефон сохранён' });
                }
              }}
            />
            <button
              onClick={async (e) => {
                const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                const val = input?.value?.trim();
                if (!val) return;
                await supabase.from('profiles').update({ phone: val }).eq('user_id', client.user_id);
                onSessionChange();
                toast({ title: lang === 'en' ? 'Phone saved' : 'Телефон сохранён' });
              }}
              className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
            >
              {lang === 'en' ? 'Save' : 'ОК'}
            </button>
          </div>
        )}
      </div>

      {/* Reset password */}
      {!showResetPw ? (
        <button
          onClick={() => setShowResetPw(true)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <KeyRound className="w-3 h-3" />
          {lang === 'en' ? 'Reset password' : 'Сбросить пароль'}
        </button>
      ) : (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder={lang === 'en' ? 'New password' : 'Новый пароль'}
            value={resetPw}
            onChange={(e) => setResetPw(e.target.value)}
            className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
          />
          <button
            onClick={handleResetPassword}
            disabled={resettingPw}
            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {resettingPw ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === 'en' ? 'Set' : 'ОК')}
          </button>
          <button
            onClick={() => { setShowResetPw(false); setResetPw(''); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      {/* Packages — accordion */}
      <AccordionSection
        icon={<Package className="w-4 h-4 text-primary" />}
        title={lang === 'en' ? 'Packages' : 'Пакеты'}
        isOpen={openSection === 'packages'}
        onToggle={() => toggleSection('packages')}
        badge={clientPkgs.filter(p => p.is_active).length > 0 
          ? `${clientPkgs.find(p => p.is_active)!.total_sessions - clientPkgs.find(p => p.is_active)!.used_sessions} left` 
          : undefined}
      >
        <div className="space-y-3">
          {clientPkgs.filter(p => p.is_active).map(pkg => (
            <div key={pkg.id} className="bg-secondary/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">{pkg.package_name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{pkg.used_sessions}/{pkg.total_sessions}</p>
                  <button
                    onClick={() => onDeletePackage(pkg.id)}
                    className="w-6 h-6 rounded-md bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
                <div
                  className="h-full gradient-primary rounded-full transition-all"
                  style={{ width: `${((pkg.total_sessions - pkg.used_sessions) / pkg.total_sessions) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onAddSession(pkg.id, 1)}
                  className="flex-1 bg-primary/20 text-primary text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-primary/30 transition-colors"
                >
                  <Plus className="w-3 h-3" /> {lang === 'en' ? 'Used' : 'Израсходовано'}
                </button>
                <button
                  onClick={() => onAddSession(pkg.id, -1)}
                  className="flex-1 bg-secondary text-foreground text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-secondary/80 transition-colors"
                >
                  <Minus className="w-3 h-3" /> {lang === 'en' ? 'Undo' : 'Отмена'}
                </button>
              </div>
            </div>
          ))}

          {/* New package */}
          <div className="bg-secondary/30 rounded-lg p-2.5 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {lang === 'en' ? 'New Package' : 'Новый пакет'}
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                placeholder={lang === 'en' ? 'Number of sessions' : 'Количество занятий'}
                value={newPkgName}
                onChange={(e) => setNewPkgName(e.target.value)}
                className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={handleCreatePackage}
                disabled={!newPkgName.trim()}
                className="gradient-primary text-primary-foreground text-xs font-bold py-2 px-4 rounded-lg disabled:opacity-50"
              >
                {lang === 'en' ? 'Add' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* Schedule */}
      <AccordionSection
        icon={<CalendarDays className="w-4 h-4 text-primary" />}
        title={lang === 'en' ? 'Schedule' : 'Расписание'}
        isOpen={openSection === 'schedule'}
        onToggle={() => toggleSection('schedule')}
      >
        <ClientSchedule userId={client.user_id} lang={lang} onSessionChange={onSessionChange} />
      </AccordionSection>

      {/* Body Measurements — view + input */}
      <AccordionSection
        icon={<Ruler className="w-4 h-4 text-primary" />}
        title={lang === 'en' ? 'Body Measurements' : 'Замеры тела'}
        isOpen={openSection === 'measurements'}
        onToggle={() => toggleSection('measurements')}
      >
        <div className="space-y-3">
          <BodyMeasurementsView userId={client.user_id} lang={lang} />
          <BodyMeasurementsInput userId={client.user_id} lang={lang} />
        </div>
      </AccordionSection>

      {/* Whoop */}
      <AccordionSection
        icon={<Activity className="w-4 h-4 text-primary" />}
        title="Whoop"
        isOpen={openSection === 'whoop'}
        onToggle={() => toggleSection('whoop')}
      >
        <TrainerWhoopWidget userId={client.user_id} lang={lang} />
      </AccordionSection>

      {/* Tests */}
      <AccordionSection
        icon={<ClipboardCheck className="w-4 h-4 text-primary" />}
        title={lang === 'en' ? 'Health Tests' : 'Тесты здоровья'}
        isOpen={openSection === 'tests'}
        onToggle={() => toggleSection('tests')}
      >
        <ClientTestHistory userId={client.user_id} lang={lang} />
      </AccordionSection>

      {/* Notifications */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSendRemaining}
          className="flex-1 bg-primary/10 border border-primary/30 text-primary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 hover:bg-primary/20 transition-colors"
        >
          <Send className="w-3 h-3" /> {lang === 'en' ? 'Remaining' : 'Остаток'}
        </button>
        <button
          onClick={onSendRenewal}
          className="flex-1 bg-accent/10 border border-accent/30 text-accent-foreground text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 hover:bg-accent/20 transition-colors"
        >
          <Send className="w-3 h-3" /> {lang === 'en' ? 'Renewal' : 'Продление'}
        </button>
      </div>

      {/* Delete client */}
      {onDeleteClient && (
        <button
          onClick={onDeleteClient}
          className="w-full mt-2 bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-destructive/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> {lang === 'en' ? 'Delete client' : 'Удалить клиента'}
        </button>
      )}
    </motion.div>
  );
};

export default ClientDetailAccordion;
