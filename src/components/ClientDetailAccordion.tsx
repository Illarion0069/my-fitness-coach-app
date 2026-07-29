import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, CalendarDays, Ruler, Activity, ClipboardCheck, Send, Plus, Minus, Trash2, Save, KeyRound, Loader2, Camera, UtensilsCrossed, Phone, Mail, User, Archive, ArchiveRestore, Sparkles, MoreHorizontal, ChevronDown } from 'lucide-react';
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
import SessionLedgerHistory from './SessionLedgerHistory';

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
  archived_at?: string | null;
  archive_reason?: string | null;
  reactivation_sent_at?: string | null;
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
  onArchiveClient?: () => void;
  onUnarchiveClient?: () => void;
  onSendReactivation?: () => void;
}

type TabId = 'overview' | 'nutrition' | 'schedule' | 'body' | 'ledger' | 'tests' | 'info';

// Primary tabs — daily-use for trainer
const primaryTabs: { id: TabId; icon: React.ReactNode; labelEn: string; labelRu: string }[] = [
  { id: 'overview', icon: <Package className="w-3.5 h-3.5" />, labelEn: 'Overview', labelRu: 'Главное' },
  { id: 'nutrition', icon: <UtensilsCrossed className="w-3.5 h-3.5" />, labelEn: 'Food', labelRu: 'Питание' },
  { id: 'body', icon: <Ruler className="w-3.5 h-3.5" />, labelEn: 'Body', labelRu: 'Замеры' },
];

// Secondary — hidden under "More"
const moreTabs: { id: TabId; icon: React.ReactNode; labelEn: string; labelRu: string }[] = [
  { id: 'schedule', icon: <CalendarDays className="w-3.5 h-3.5" />, labelEn: 'Schedule', labelRu: 'Расписание' },
  { id: 'ledger', icon: <Activity className="w-3.5 h-3.5" />, labelEn: 'Session history', labelRu: 'История списаний' },
  { id: 'tests', icon: <ClipboardCheck className="w-3.5 h-3.5" />, labelEn: 'Tests', labelRu: 'Тесты' },
  { id: 'info', icon: <User className="w-3.5 h-3.5" />, labelEn: 'Account', labelRu: 'Аккаунт' },
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
  onArchiveClient,
  onUnarchiveClient,
  onSendReactivation,
}: Props) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickBodyOpen, setQuickBodyOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [measurementKey, setMeasurementKey] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);
  const [calorieGoalInput, setCalorieGoalInput] = useState('');
  const [loadingGoal, setLoadingGoal] = useState(true);
  const [nutritionGoal, setNutritionGoal] = useState<'fat_loss' | 'muscle_gain'>('fat_loss');
  const [savingNutritionGoal, setSavingNutritionGoal] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('daily_calorie_goal, nutrition_goal').eq('user_id', client.user_id).maybeSingle()
      .then(({ data }) => {
        const goal = (data as any)?.daily_calorie_goal || null;
        setCalorieGoal(goal);
        setCalorieGoalInput(goal ? String(goal) : '');
        const ng = (data as any)?.nutrition_goal === 'muscle_gain' ? 'muscle_gain' : 'fat_loss';
        setNutritionGoal(ng);
        setLoadingGoal(false);
      });
  }, [client.user_id]);

  const saveCalorieGoal = async () => {
    const val = parseInt(calorieGoalInput.trim()) || null;
    await supabase.from('profiles').update({ daily_calorie_goal: val } as any).eq('user_id', client.user_id);
    setCalorieGoal(val);
    toast({ title: lang === 'en' ? 'Goal saved' : 'Цель сохранена' });
  };

  const saveNutritionGoal = async (next: 'fat_loss' | 'muscle_gain') => {
    if (next === nutritionGoal || savingNutritionGoal) return;
    setSavingNutritionGoal(true);
    const prev = nutritionGoal;
    setNutritionGoal(next);
    const { data, error } = await supabase
      .from('profiles')
      .update({ nutrition_goal: next } as any)
      .eq('user_id', client.user_id)
      .select('user_id, nutrition_goal');
    setSavingNutritionGoal(false);
    console.log('[nutrition_goal] save result:', { next, data, error });

    if (error || !data || data.length === 0) {
      setNutritionGoal(prev);
      toast({
        title: lang === 'en' ? 'Failed to save plan' : 'Не удалось сохранить план',
        description: error?.message || (lang === 'en' ? 'No rows updated (permission issue)' : 'Изменение не применилось (нет прав)'),
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: lang === 'en'
        ? (next === 'muscle_gain' ? 'Plan: Muscle gain' : 'Plan: Fat loss')
        : (next === 'muscle_gain' ? 'План: Набор мышц' : 'План: Снижение веса'),
    });
    onSessionChange?.();
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
    if (resetPw.length < 8) {
      toast({ title: lang === 'en' ? 'Min 8 characters' : 'Минимум 8 символов', variant: 'destructive' });
      return;
    }
    setResettingPw(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { action: 'trainer_reset', client_user_id: client.user_id, new_password: resetPw },
      });
      // Extract real body from FunctionsHttpError (else message is just "non-2xx status code")
      let errCode = '';
      let errMsg = '';
      if (error) {
        try {
          const ctx: any = (error as any).context;
          const parsed = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
          errCode = parsed?.error || '';
          errMsg = parsed?.message || '';
        } catch {}
        if (!errCode) errCode = (error as any).message || '';
      }
      if (data?.error) errCode = data.error;
      if (errCode) throw new Error(errMsg || errCode);
      toast({ title: lang === 'en' ? 'Password updated' : 'Пароль обновлён' });
      setResetPw('');
      setShowResetPw(false);
    } catch (e: any) {
      const raw = ((e?.message || '') + ' ' + (e?.code || '')).toLowerCase();
      const isPwned = raw.includes('pwned') || raw.includes('compromised') || raw.includes('breach');
      const isWeak = raw.includes('weak') || raw.includes('short') || raw.includes('length');
      const friendly = isPwned
        ? (lang === 'en'
            ? 'This password was found in a public breach. Try a unique one (e.g. add numbers/symbols).'
            : 'Этот пароль найден в утечках. Придумайте уникальный — добавьте цифры и символы.')
        : isWeak
        ? (lang === 'en' ? 'Password is too weak. Use 8+ chars with letters, digits and a symbol.' : 'Пароль слишком слабый. Минимум 8 символов: буквы, цифры и символ.')
        : e?.message || (lang === 'en' ? 'Unknown error' : 'Неизвестная ошибка');
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: friendly, variant: 'destructive' });
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

            {/* Archive status banner (when archived) */}
            {client.archived_at && (
              <div className="pt-2 space-y-2">
                <div className="bg-secondary/40 border border-border/50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <Archive className="w-3 h-3" />
                    {lang === 'en' ? 'In archive' : 'В архиве'}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {lang === 'en' ? 'Since' : 'С'} {new Date(client.archived_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU')}
                  </p>
                  {client.reactivation_sent_at && (
                    <p className="text-[11px] text-primary font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {lang === 'en' ? 'Offer sent' : 'Предложение отправлено'} {new Date(client.reactivation_sent_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU')}
                    </p>
                  )}
                </div>

                {onSendReactivation && (
                  <ReactivationButton
                    onSend={onSendReactivation}
                    lang={lang}
                    alreadySent={!!client.reactivation_sent_at}
                  />
                )}

                {onUnarchiveClient && (
                  <button
                    onClick={onUnarchiveClient}
                    className="w-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-primary/20 transition-colors"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    {lang === 'en' ? 'Restore to active' : 'Вернуть в активные'}
                  </button>
                )}
              </div>
            )}

            {/* Archive (only when active) */}
            {!client.archived_at && onArchiveClient && (
              <ArchiveClientButton onArchive={onArchiveClient} lang={lang} />
            )}

            {/* Delete client */}
            {onDeleteClient && (
              <DeleteClientButton onDeleteClient={onDeleteClient} lang={lang} />
            )}
          </div>
        );

      case 'overview': {
        const sortedPkgs = [...clientPkgs].sort(
          (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        const latestPkg = sortedPkgs[0];
        const debt = latestPkg ? Math.max(0, latestPkg.used_sessions - latestPkg.total_sessions) : 0;
        const activePkg = sortedPkgs.find(p => p.is_active) || sortedPkgs[0];
        return (
          <div className="space-y-3">
            {/* Contact strip — compact */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>
              {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
            </div>

            {/* PACKAGE — primary action zone */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                {lang === 'en' ? 'Package' : 'Пакет'}
              </p>
              {debt > 0 && (
                <div className="bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-1.5">
                  <p className="text-[11px] font-bold text-destructive">
                    −{debt} {lang === 'en' ? `session${debt > 1 ? 's' : ''}` : 'занятий'}
                    <span className="font-normal text-destructive/70 ml-1">
                      {lang === 'en' ? '· auto-deducts on next pkg' : '· спишется при новом'}
                    </span>
                  </p>
                </div>
              )}
              {activePkg ? (
                <div className="bg-secondary/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{activePkg.package_name}</p>
                      {activePkg.price_paid != null && (
                        <p className="text-[10px] text-muted-foreground">€{activePkg.price_paid}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs font-bold text-foreground">{activePkg.used_sessions}<span className="text-muted-foreground font-normal">/{activePkg.total_sessions}</span></p>
                      <button
                        onClick={() => onDeletePackage(activePkg.id)}
                        className="w-6 h-6 rounded-md bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
                        aria-label={lang === 'en' ? 'Delete package' : 'Удалить пакет'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2.5">
                    <div className="h-full gradient-primary rounded-full transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, ((activePkg.total_sessions - activePkg.used_sessions) / activePkg.total_sessions) * 100))}%` }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onAddSession(activePkg.id, 1)}
                      className="flex-1 bg-primary/20 text-primary text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-primary/30 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => onAddSession(activePkg.id, -1)}
                      className="flex-1 bg-secondary text-foreground text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-secondary/80 transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                    <button onClick={onSendRemaining}
                      className="bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-primary/20 transition-colors">
                      <Send className="w-3 h-3" /> {lang === 'en' ? 'Send' : 'Отчёт'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic px-1">
                  {lang === 'en' ? 'No active package' : 'Активного пакета нет'}
                </p>
              )}
              {/* New package inline */}
              <div className="flex gap-1.5">
                <input type="number" min={1} placeholder={lang === 'en' ? 'Sessions' : 'Занятий'}
                  value={newPkgName} onChange={e => setNewPkgName(e.target.value)}
                  className="flex-1 bg-background border border-border/50 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/50" />
                <input type="number" min={0} step={1} placeholder="€"
                  value={newPkgPrice} onChange={e => setNewPkgPrice(e.target.value)}
                  className="w-16 bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50" />
                <button onClick={handleCreatePackage} disabled={!newPkgName.trim()}
                  className="gradient-primary text-primary-foreground text-xs font-bold py-1.5 px-3 rounded-lg disabled:opacity-40">
                  {lang === 'en' ? 'New' : 'Новый'}
                </button>
              </div>
              <div className="flex gap-1.5">
                <button onClick={onSendRenewal}
                  className="flex-1 bg-accent/10 border border-accent/30 text-accent-foreground text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-accent/20 transition-colors">
                  <Send className="w-3 h-3" /> {lang === 'en' ? 'Renewal' : 'Продление'}
                </button>
                <button onClick={onSendGymRenewal}
                  className="flex-1 bg-secondary/50 border border-border/50 text-foreground text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-secondary/80 transition-colors">
                  <Send className="w-3 h-3" /> {lang === 'en' ? 'Gym 150€' : 'Зал 150€'}
                </button>
              </div>
            </div>

            {/* SESSION LEDGER — full deduction / refund history */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setLedgerOpen(o => !o)}
                className="w-full flex items-center justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                <span>{lang === 'en' ? 'Session history' : 'История списаний'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${ledgerOpen ? 'rotate-180' : ''}`} />
              </button>
              {ledgerOpen && <SessionLedgerHistory userId={client.user_id} lang={lang === 'en' ? 'en' : 'ru'} />}
            </div>



            {/* NUTRITION TARGETS — compact */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                {lang === 'en' ? 'Nutrition goals' : 'Цели по питанию'}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { key: 'fat_loss' as const, ru: 'Снижение', en: 'Fat loss', emoji: '🔥' },
                  { key: 'muscle_gain' as const, ru: 'Набор', en: 'Muscle', emoji: '💪' },
                ]).map(opt => {
                  const active = nutritionGoal === opt.key;
                  return (
                    <button key={opt.key} onClick={() => saveNutritionGoal(opt.key)} disabled={savingNutritionGoal}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all border ${
                        active ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border/50 hover:border-primary/50'
                      } ${savingNutritionGoal ? 'opacity-60' : ''}`}>
                      <span className="mr-1">{opt.emoji}</span>{lang === 'en' ? opt.en : opt.ru}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1.5 items-center">
                <input type="number" min={0} placeholder={lang === 'en' ? 'kcal / day' : 'ккал / день'}
                  value={calorieGoalInput} onChange={e => setCalorieGoalInput(e.target.value)}
                  className="flex-1 bg-background border border-border/50 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/50" />
                <button onClick={saveCalorieGoal}
                  className="text-xs font-bold text-primary hover:text-primary/80 px-2">
                  {lang === 'en' ? 'Save' : 'ОК'}
                </button>
              </div>
            </div>

            {/* BODY QUICK INPUT */}
            <div className="space-y-2">
              <button onClick={() => setQuickBodyOpen(v => !v)}
                className="w-full flex items-center justify-between">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  {lang === 'en' ? 'Log measurements' : 'Записать замеры'}
                </p>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${quickBodyOpen ? 'rotate-180' : ''}`} />
              </button>
              {quickBodyOpen && (
                <BodyMeasurementsInput userId={client.user_id} lang={lang} onSaved={() => setMeasurementKey(k => k + 1)} />
              )}
            </div>
          </div>
        );
      }

      case 'schedule':
        return <ClientSchedule userId={client.user_id} lang={lang} onSessionChange={onSessionChange} />;

      case 'body':
        return (
          <div className="space-y-3">
            <BodyMeasurementsView key={measurementKey} userId={client.user_id} lang={lang} editable />
            <BodyMeasurementsInput userId={client.user_id} lang={lang} onSaved={() => setMeasurementKey(k => k + 1)} />
          </div>
        );

      case 'whoop':
        return <TrainerWhoopWidget userId={client.user_id} lang={lang} />;

      case 'tests':
        return <ClientTestHistory userId={client.user_id} lang={lang} trainerView />;

      case 'photos':
        return <ClientProgressPhotos userId={client.user_id} lang={lang} />;

      case 'nutrition':
        return (
          <div className="space-y-3">
            {calorieGoal != null && (
              <p className="text-[10px] text-muted-foreground px-1">
                {lang === 'en' ? `Target: ${calorieGoal} kcal/day · ${nutritionGoal === 'muscle_gain' ? 'Muscle gain' : 'Fat loss'}` : `Цель: ${calorieGoal} ккал/день · ${nutritionGoal === 'muscle_gain' ? 'набор мышц' : 'снижение веса'}`}
              </p>
            )}
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
      {/* Primary tabs + More menu */}
      <div className="border-b border-border/20 relative">
        <div className="flex items-center gap-0.5 px-3 py-2">
          {primaryTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }}
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
          <div className="ml-auto relative">
            <button
              onClick={() => setMoreOpen(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                moreTabs.some(t => t.id === activeTab)
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              {lang === 'en' ? 'More' : 'Ещё'}
              <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border/50 rounded-lg shadow-xl overflow-hidden min-w-[160px]">
                {moreTabs.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-left transition-colors ${
                        isActive ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      {tab.icon}
                      {lang === 'en' ? tab.labelEn : tab.labelRu}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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

const ArchiveClientButton = ({ onArchive, lang }: { onArchive: () => void; lang: string }) => {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="w-full mt-2 space-y-1.5">
        <p className="text-xs text-foreground font-semibold text-center">
          {lang === 'en' ? 'Move to archive?' : 'В архив?'}
        </p>
        <p className="text-[11px] text-muted-foreground text-center">
          {lang === 'en'
            ? 'Client will be hidden from active list but data is kept.'
            : 'Клиент скроется из активных, данные сохранятся.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => { setConfirming(false); onArchive(); }}
            className="flex-1 bg-primary text-primary-foreground text-xs font-bold py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            {lang === 'en' ? 'Yes, archive' : 'Да, в архив'}
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
      className="w-full mt-2 bg-secondary/50 border border-border/50 text-foreground text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-secondary/80 transition-colors"
    >
      <Archive className="w-3.5 h-3.5" /> {lang === 'en' ? 'Move to archive' : 'В архив'}
    </button>
  );
};

const ReactivationButton = ({ onSend, lang, alreadySent }: { onSend: () => void; lang: string; alreadySent: boolean }) => {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="w-full space-y-1.5">
        <p className="text-xs text-foreground font-semibold text-center">
          {lang === 'en' ? 'Send -20% offer in Telegram?' : 'Отправить предложение -20% в Telegram?'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => { setConfirming(false); onSend(); }}
            className="flex-1 bg-primary text-primary-foreground text-xs font-bold py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            {lang === 'en' ? 'Yes, send' : 'Да, отправить'}
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
      className="w-full bg-primary text-primary-foreground text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors"
    >
      <Sparkles className="w-3.5 h-3.5" />
      {alreadySent
        ? (lang === 'en' ? 'Send offer again' : 'Отправить предложение ещё раз')
        : (lang === 'en' ? 'Send -20% offer' : 'Отправить -20%')}
    </button>
  );
};

export default ClientDetailAccordion;
