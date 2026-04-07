import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, CalendarDays, Ruler, Activity, ClipboardCheck, Send, Plus, Minus, Trash2, Save, KeyRound, Loader2, Camera, UtensilsCrossed, Phone, Mail, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ClientSchedule from './ClientSchedule';
import TrainerWhoopWidget from './TrainerWhoopWidget';
import ClientTestHistory from './ClientTestHistory';
import BodyMeasurementsInput from './BodyMeasurementsInput';
import BodyMeasurementsView from './BodyMeasurementsView';
import ClientProgressPhotos from './ClientProgressPhotos';
import NutritionDiary from './NutritionDiary';
import TrainerClientAchievements from './TrainerClientAchievements';

interface ClientPackage {
  id: string;
  user_id: string;
  package_name: string;
  total_sessions: number;
  used_sessions: number;
  is_active: boolean;
  price_paid: number | null;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
}

interface Props {
  client: Profile;
  clientPkgs: ClientPackage[];
  lang: string;
  onSessionChange: () => void;
  onAddSession: (pkgId: string, delta: number) => void;
  onDeletePackage: (pkgId: string) => void;
  onCreatePackage: (userId: string, sessions: number, pricePaid: number | null) => void;
  onSendRemaining: () => void;
  onSendRenewal: () => void;
  onSendGymRenewal: () => void;
  onDeleteClient?: () => void;
}

type TabId = 'info' | 'packages' | 'schedule' | 'measurements' | 'whoop' | 'tests' | 'photos' | 'nutrition';

const tabs: { id: TabId; icon: React.ReactNode; labelEn: string; labelRu: string }[] = [
  { id: 'info', icon: <User className="w-3.5 h-3.5" />, labelEn: 'Info', labelRu: 'Инфо' },
  { id: 'packages', icon: <Package className="w-3.5 h-3.5" />, labelEn: 'Pkgs', labelRu: 'Пакеты' },
  { id: 'schedule', icon: <CalendarDays className="w-3.5 h-3.5" />, labelEn: 'Schedule', labelRu: 'Расписание' },
  { id: 'nutrition', icon: <UtensilsCrossed className="w-3.5 h-3.5" />, labelEn: 'Food', labelRu: 'Питание' },
  { id: 'measurements', icon: <Ruler className="w-3.5 h-3.5" />, labelEn: 'Body', labelRu: 'Замеры' },
  { id: 'photos', icon: <Camera className="w-3.5 h-3.5" />, labelEn: 'Photos', labelRu: 'Фото' },
  { id: 'whoop', icon: <Activity className="w-3.5 h-3.5" />, labelEn: 'Whoop', labelRu: 'Whoop' },
  { id: 'tests', icon: <ClipboardCheck className="w-3.5 h-3.5" />, labelEn: 'Tests', labelRu: 'Тесты' },
];

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
  onSendGymRenewal,
  onDeleteClient,
}: Props) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [measurementKey, setMeasurementKey] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);
  const [calorieGoalInput, setCalorieGoalInput] = useState('');
  const [loadingGoal, setLoadingGoal] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('daily_calorie_goal').eq('user_id', client.user_id).maybeSingle()
      .then(({ data }) => {
        const goal = (data as any)?.daily_calorie_goal || null;
        setCalorieGoal(goal);
        setCalorieGoalInput(goal ? String(goal) : '');
        setLoadingGoal(false);
      });
  }, [client.user_id]);

  const saveCalorieGoal = async () => {
    const val = parseInt(calorieGoalInput.trim()) || null;
    await supabase.from('profiles').update({ daily_calorie_goal: val } as any).eq('user_id', client.user_id);
    setCalorieGoal(val);
    toast({ title: lang === 'en' ? 'Goal saved' : 'Цель сохранена' });
  };

  const handleCreatePackage = () => {
    const parsed = parseInt(newPkgName.trim(), 10);
    if (!parsed || parsed <= 0) {
      toast({ title: lang === 'en' ? 'Enter a number' : 'Введите число', variant: 'destructive' });
      return;
    }
    const price = newPkgPrice.trim() ? parseFloat(newPkgPrice.trim()) : null;
    if (price !== null && (isNaN(price) || price < 0)) {
      toast({ title: lang === 'en' ? 'Invalid price' : 'Неверная сумма', variant: 'destructive' });
      return;
    }
    onCreatePackage(client.user_id, parsed, price);
    setNewPkgName('');
    setNewPkgPrice('');
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return (
          <div className="space-y-3">
            {/* Contact info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-foreground">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                {client.email}
              </div>
              {client.phone ? (
                <div className="flex items-center gap-2 text-xs text-foreground">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  {client.phone}
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
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

            {/* Notifications */}
            <div className="pt-2 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {lang === 'en' ? 'Notifications' : 'Уведомления'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onSendRemaining}
                  className="flex-1 bg-primary/10 border border-primary/30 text-primary text-[11px] font-bold py-2 rounded-xl flex items-center justify-center gap-1 hover:bg-primary/20 transition-colors"
                >
                  <Send className="w-3 h-3" /> {lang === 'en' ? 'Remaining' : 'Остаток'}
                </button>
                <button
                  onClick={onSendRenewal}
                  className="flex-1 bg-accent/10 border border-accent/30 text-accent-foreground text-[11px] font-bold py-2 rounded-xl flex items-center justify-center gap-1 hover:bg-accent/20 transition-colors"
                >
                  <Send className="w-3 h-3" /> {lang === 'en' ? 'Renewal' : 'Продление'}
                </button>
              </div>
              <button
                onClick={onSendGymRenewal}
                className="w-full bg-secondary/50 border border-border/50 text-foreground text-[11px] font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-secondary/80 transition-colors"
              >
                <Send className="w-3 h-3" /> {lang === 'en' ? 'Gym 150€' : 'Зал 150€'}
              </button>
            </div>

            {/* Delete client */}
            {onDeleteClient && (
              <DeleteClientButton onDeleteClient={onDeleteClient} lang={lang} />
            )}
          </div>
        );

      case 'packages':
        return (
          <div className="space-y-3">
            {clientPkgs.filter(p => p.is_active).map(pkg => (
              <div key={pkg.id} className="bg-secondary/50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">{pkg.package_name}</p>
                    {pkg.price_paid != null && (
                      <p className="text-[10px] text-muted-foreground">€{pkg.price_paid}</p>
                    )}
                  </div>
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
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onAddSession(pkg.id, -1)}
                    className="flex-1 bg-secondary text-foreground text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-secondary/80 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
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
                  placeholder={lang === 'en' ? 'Sessions' : 'Занятий'}
                  value={newPkgName}
                  onChange={(e) => setNewPkgName(e.target.value)}
                  className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="€"
                  value={newPkgPrice}
                  onChange={(e) => setNewPkgPrice(e.target.value)}
                  className="w-20 bg-background border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
                />
                <button
                  onClick={handleCreatePackage}
                  disabled={!newPkgName.trim()}
                  className="gradient-primary text-primary-foreground text-xs font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                >
                  {lang === 'en' ? 'Add' : '+'}
                </button>
              </div>
            </div>
          </div>
        );

      case 'schedule':
        return <ClientSchedule userId={client.user_id} lang={lang} onSessionChange={onSessionChange} />;

      case 'measurements':
        return (
          <div className="space-y-3">
            <BodyMeasurementsView key={measurementKey} userId={client.user_id} lang={lang} />
            <BodyMeasurementsInput userId={client.user_id} lang={lang} onSaved={() => setMeasurementKey(k => k + 1)} />
          </div>
        );

      case 'whoop':
        return <TrainerWhoopWidget userId={client.user_id} lang={lang} />;

      case 'tests':
        return <ClientTestHistory userId={client.user_id} lang={lang} />;

      case 'photos':
        return <ClientProgressPhotos userId={client.user_id} lang={lang} />;

      case 'nutrition':
        return (
          <div className="space-y-3">
            <div className="bg-secondary/30 rounded-xl p-3">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                {lang === 'en' ? 'Daily calorie goal' : 'Дневная норма калорий'}
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={0}
                  placeholder={lang === 'en' ? 'e.g. 2000' : 'напр. 2000'}
                  value={calorieGoalInput}
                  onChange={e => setCalorieGoalInput(e.target.value)}
                  className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50"
                />
                <span className="text-[10px] text-muted-foreground">{lang === 'en' ? 'kcal' : 'ккал'}</span>
                <button onClick={saveCalorieGoal}
                  className="text-xs font-bold text-primary hover:text-primary/80 transition-colors px-2">
                  {lang === 'en' ? 'Save' : 'ОК'}
                </button>
              </div>
              {calorieGoal && (
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {lang === 'en' ? `Current: ${calorieGoal} kcal/day` : `Текущая: ${calorieGoal} ккал/день`}
                </p>
              )}
            </div>
            <TrainerClientAchievements userId={client.user_id} lang={lang} />
            <NutritionDiary userId={client.user_id} lang={lang} isTrainer={true} calorieGoal={calorieGoal} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="border-t border-border/30"
    >
      {/* Horizontal scrollable tabs */}
      <div className="overflow-x-auto scrollbar-hide border-b border-border/20">
        <div className="flex gap-0.5 px-3 py-2 min-w-max">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                {tab.icon}
                {lang === 'en' ? tab.labelEn : tab.labelRu}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const DeleteClientButton = ({ onDeleteClient, lang }: { onDeleteClient: () => void; lang: string }) => {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="w-full mt-2 space-y-1.5">
        <p className="text-xs text-destructive font-semibold text-center">
          {lang === 'en' ? 'Are you sure?' : 'Вы уверены?'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => { setConfirming(false); onDeleteClient(); }}
            className="flex-1 bg-destructive text-destructive-foreground text-xs font-bold py-2.5 rounded-xl hover:bg-destructive/90 transition-colors"
          >
            {lang === 'en' ? 'Yes, delete' : 'Да, удалить'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 bg-secondary text-foreground text-xs font-bold py-2.5 rounded-xl hover:bg-secondary/80 transition-colors"
          >
            {lang === 'en' ? 'Cancel' : 'Отмена'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full mt-2 bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-destructive/20 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" /> {lang === 'en' ? 'Delete client' : 'Удалить клиента'}
    </button>
  );
};

export default ClientDetailAccordion;
