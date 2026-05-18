import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, Reorder } from 'framer-motion';
import { Users, Send, UserPlus, LogOut, GripVertical, CalendarDays, Clock, Search, X, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import DraggableClientRow from '@/components/DraggableClientRow';
import TrainerCalendar from '@/components/TrainerCalendar';
import ClientDetailAccordion from '@/components/ClientDetailAccordion';
import FinanceStatsView from '@/components/FinanceStatsView';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  reactivation_sent_at: string | null;
}

interface ClientPackage {
  id: string;
  user_id: string;
  package_name: string;
  total_sessions: number;
  used_sessions: number;
  is_active: boolean;
  price_paid: number | null;
}

const AdminSection = () => {
  const { lang } = useLanguage();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Profile[]>([]);
  const [clientOrder, setClientOrder] = useState<string[]>([]);
  const [packages, setPackages] = useState<Record<string, ClientPackage[]>>({});
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [inviting, setInviting] = useState(false);
  const [viewMode, setViewMode] = useState<'clients' | 'calendar' | 'stats'>('clients');
  const [allSessions, setAllSessions] = useState<{ user_id: string; session_date: string; is_recurring: boolean; recurrence_day: number | null }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [archiveView, setArchiveView] = useState<'active' | 'archived'>('active');

  const fetchSupplementalData = useCallback(async () => {
    const [{ data: pkgData }, { data: sessData }] = await Promise.all([
      supabase.from('client_packages').select('*').order('created_at', { ascending: false }),
      supabase.from('scheduled_sessions').select('user_id, session_date, is_recurring, recurrence_day'),
    ]);

    const grouped: Record<string, ClientPackage[]> = {};
    ((pkgData || []) as ClientPackage[]).forEach((p) => {
      if (!grouped[p.user_id]) grouped[p.user_id] = [];
      grouped[p.user_id].push(p);
    });

    setPackages(grouped);
    setAllSessions((sessData || []) as { user_id: string; session_date: string; is_recurring: boolean; recurrence_day: number | null }[]);
  }, []);

  const fetchBaseData = useCallback(async () => {
    const [{ data: profileData }, { data: orderData }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('trainer_client_order').select('*').limit(1).maybeSingle(),
    ]);

    const fetched = (profileData || []) as Profile[];
    setClients(fetched);

    const savedOrder: string[] = (orderData as any)?.client_order || [];
    const existingIds = new Set(savedOrder);
    const newIds = fetched.map(c => c.user_id).filter(id => !existingIds.has(id));
    const validIds = savedOrder.filter(id => fetched.some(c => c.user_id === id));
    setClientOrder([...validIds, ...newIds]);
  }, []);

  const fetchData = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
      try {
        await fetchBaseData();
      } finally {
        setLoading(false);
      }
      void fetchSupplementalData();
      return;
    }

    await Promise.all([fetchBaseData(), fetchSupplementalData()]);
  }, [fetchBaseData, fetchSupplementalData]);

  const saveClientOrder = useCallback(async (order: string[]) => {
    const { data: existing } = await supabase
      .from('trainer_client_order')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('trainer_client_order')
        .update({ client_order: order, updated_at: new Date().toISOString() })
        .eq('id', (existing as any).id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('trainer_client_order')
          .insert({ trainer_user_id: user.id, client_order: order });
      }
    }
  }, []);

  const handleReorder = (newOrder: string[]) => {
    setClientOrder(newOrder);
    saveClientOrder(newOrder);
  };

  useEffect(() => { void fetchData(true); }, [fetchData]);

  const addSession = async (pkgId: string, delta: number) => {
    const allPkgs = Object.values(packages).flat();
    const pkg = allPkgs.find((p) => p.id === pkgId);
    if (!pkg) return;
    const newUsed = Math.max(0, Math.min(pkg.total_sessions, pkg.used_sessions + delta));
    await supabase.from('client_packages').update({ used_sessions: newUsed }).eq('id', pkgId);
    fetchData();
  };

  const deletePackage = async (pkgId: string) => {
    await supabase.from('client_packages').delete().eq('id', pkgId);
    fetchData();
    toast({ title: lang === 'en' ? 'Package deleted' : 'Пакет удалён' });
  };


  const deleteClient = async (client: Profile) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-client', {
        body: { client_user_id: client.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      fetchData();
      toast({ title: lang === 'en' ? 'Client deleted' : 'Клиент удалён', description: client.full_name });
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: e.message, variant: 'destructive' });
    }
  };

  const archiveClient = async (client: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ archived_at: new Date().toISOString() })
      .eq('user_id', client.user_id);
    if (error) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    setSelectedClient(null);
    fetchData();
    toast({
      title: lang === 'en' ? 'Moved to archive' : 'В архиве',
      description: client.full_name,
    });
  };

  const unarchiveClient = async (client: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ archived_at: null, archive_reason: null })
      .eq('user_id', client.user_id);
    if (error) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    fetchData();
    toast({
      title: lang === 'en' ? 'Restored to active' : 'Возвращён в активные',
      description: client.full_name,
    });
  };

  const sendReactivationOffer = async (client: Profile) => {
    const message = `💪 <b>Limassol Fitness</b>\n\n${client.full_name}, давно не виделись! Скучаем по вашим тренировкам.\n\n🎁 <b>Возвращайтесь со скидкой -20%</b> на любой пакет тренировок:\n• 8 занятий — <s>750€</s> <b>600€</b>\n• 12 занятий — <s>1030€</s> <b>824€</b>\n• 20 занятий — <s>1599€</s> <b>1279€</b>\n\nПросто напишите тренеру — забронируем удобное время. Ждём! 🔥`;
    const { data, error } = await supabase.functions.invoke('send-telegram', {
      body: { action: 'sendReminder', client_user_id: client.user_id, message },
    });
    if (error) {
      let detail = error.message;
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          if (body?.error) detail = body.error;
        }
      } catch {}
      console.error('sendReactivationOffer failed:', detail, error);
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: detail, variant: 'destructive' });
      return;
    }
    await supabase
      .from('profiles')
      .update({ reactivation_sent_at: new Date().toISOString() })
      .eq('user_id', client.user_id);
    fetchData();
    const sentToClient = data?.sent_to === 'client';
    toast({
      title: lang === 'en' ? 'Offer sent' : 'Предложение отправлено',
      description: sentToClient
        ? (lang === 'en' ? `Sent to ${client.full_name} via Telegram` : `Отправлено ${client.full_name} в Telegram`)
        : (lang === 'en' ? `${client.full_name} has no Telegram — sent to you` : `У ${client.full_name} нет Telegram — отправлено вам`),
    });
  };
  const weeklySessionCounts = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const counts: Record<string, number> = {};
    allSessions.forEach(s => {
      if (!counts[s.user_id]) counts[s.user_id] = 0;
      if (s.is_recurring && s.recurrence_day != null) {
        counts[s.user_id]++;
      } else if (!s.is_recurring) {
        const d = new Date(s.session_date + 'T00:00:00');
        if (d >= monday && d <= sunday) {
          counts[s.user_id]++;
        }
      }
    });
    return counts;
  }, [allSessions]);

  // Filtered + searched client order
  const filteredClientOrder = useMemo(() => {
    return clientOrder.filter(userId => {
      const client = clients.find(c => c.user_id === userId);
      if (!client) return false;

      // Archive view filter (top-level)
      const isArchived = !!client.archived_at;
      if (archiveView === 'active' && isArchived) return false;
      if (archiveView === 'archived' && !isArchived) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = client.full_name.toLowerCase().includes(q) || client.email.toLowerCase().includes(q) || client.phone?.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Active package filter (only relevant for non-archived view)
      if (archiveView === 'active' && filterActive !== 'all') {
        const clientPkgs = packages[userId] || [];
        const hasActive = clientPkgs.some(p => p.is_active);
        if (filterActive === 'active' && !hasActive) return false;
        if (filterActive === 'inactive' && hasActive) return false;
      }

      return true;
    });
  }, [clientOrder, clients, packages, searchQuery, filterActive, archiveView]);

  const archivedCount = useMemo(
    () => clients.filter(c => !!c.archived_at).length,
    [clients]
  );


  const sendNotification = async (client: Profile, message: string) => {
    const { data } = await supabase.functions.invoke('send-telegram', {
      body: { action: 'sendReminder', client_user_id: client.user_id, message },
    });
    const sentToClient = data?.sent_to === 'client';
    toast({
      title: lang === 'en' ? 'Sent' : 'Отправлено',
      description: sentToClient
        ? (lang === 'en' ? `Sent to ${client.full_name} via Telegram` : `Отправлено ${client.full_name} в Telegram`)
        : (lang === 'en' ? `${client.full_name} has no Telegram — sent to you` : `У ${client.full_name} нет Telegram — отправлено вам`),
    });
  };

  const sendRemainingNotification = (client: Profile) => {
    const clientPkgs = packages[client.user_id] || [];
    const activePkg = clientPkgs.find((p) => p.is_active);
    const remaining = activePkg ? activePkg.total_sessions - activePkg.used_sessions : 0;
    return sendNotification(client, `📊 <b>Limassol Fitness</b>\n\n${client.full_name}, у вас осталось <b>${remaining}</b> занятий из ${activePkg?.total_sessions || 0}.\nЗаписывайтесь на следующую тренировку! 💪\n\nОплата: <a href="https://revolut.me/illarion">Revolut</a>`);
  };

  const sendRenewalNotification = (client: Profile) => {
    return sendNotification(client, `🔄 <b>Limassol Fitness</b>\n\n${client.full_name}, пора продлить абонемент!\n\n📦 Пакеты:\n• 8 занятий — 750€\n• 12 занятий — 1030€\n• 20 занятий — 1599€\n\nОплата: <a href="https://revolut.me/illarion">Revolut</a>\nНапишите тренеру для продления! 💪`);
  };

  const sendGymRenewalNotification = (client: Profile) => {
    return sendNotification(client, `🏋️ <b>Limassol Fitness</b>\n\n${client.full_name}, напоминаем о продлении абонемента в зал!\n\n💳 Стоимость: <b>150€/мес</b>\n\nОплата: <a href="https://revolut.me/illarion">Revolut</a>`);
  };

  const inviteClient = async () => {
    if (!newClientName.trim() || !newClientEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-client', {
        body: { full_name: newClientName.trim(), email: newClientEmail.trim(), phone: newClientPhone.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: lang === 'en' ? 'Client invited!' : 'Клиент приглашён!',
        description: lang === 'en' ? `Invitation sent to ${newClientEmail}` : `Приглашение отправлено на ${newClientEmail}`,
      });
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setShowAddClient(false);
      fetchData();
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: e.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  return (
    <section className="min-h-screen bg-background px-5 pb-24" style={{ paddingTop: 'max(env(safe-area-inset-top, 20px), 20px)' }}>
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Users className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold font-heading uppercase tracking-tight">
            {lang === 'en' ? 'Clients' : 'Клиенты'}
          </h1>
          <button
            onClick={() => setShowAddClient(!showAddClient)}
            className="ml-auto w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-4 h-4" />
          </button>
          <button
            onClick={async () => {
              await signOut();
              toast({ title: lang === 'en' ? 'Signed out' : 'Вы вышли', duration: 2000 });
            }}
            className="w-9 h-9 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* View mode tabs */}
        <div className="flex gap-1 mb-4 bg-secondary/50 rounded-xl p-1">
          <button
            onClick={() => setViewMode('clients')}
            className={`flex-1 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              viewMode === 'clients' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {lang === 'en' ? 'Clients' : 'Клиенты'}
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex-1 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {lang === 'en' ? 'Calendar' : 'Календарь'}
          </button>
          <button
            onClick={() => setViewMode('stats')}
            className={`flex-1 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              viewMode === 'stats' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {lang === 'en' ? 'Stats' : 'Финансы'}
          </button>
        </div>

        {viewMode === 'stats' ? (
          <FinanceStatsView lang={lang} />
        ) : viewMode === 'calendar' ? (
          <div className="space-y-4">
            <TrainerCalendar lang={lang} clients={clients} onSessionChange={fetchData} />
          </div>
        ) : (
        <div className="space-y-0">
        {/* Add client form */}
        {showAddClient && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-card border border-border/50 rounded-2xl p-4 mb-4 space-y-3"
          >
            <p className="text-xs font-semibold flex items-center gap-1">
              <UserPlus className="w-3 h-3" /> {lang === 'en' ? 'Add Customer' : 'Добавить клиента'}
            </p>
            <input
              type="text"
              placeholder={lang === 'en' ? 'Full name' : 'Имя и фамилия'}
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
            />
            <input
              type="email"
              placeholder="Email"
              value={newClientEmail}
              onChange={(e) => setNewClientEmail(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
            />
            <input
              type="tel"
              placeholder={lang === 'en' ? 'Phone number' : 'Номер телефона'}
              value={newClientPhone}
              onChange={(e) => setNewClientPhone(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
            />
            <button
              onClick={inviteClient}
              disabled={inviting || !newClientName.trim() || !newClientEmail.trim()}
              className="w-full gradient-primary text-primary-foreground text-xs font-bold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-3 h-3" />
              {inviting
                ? (lang === 'en' ? 'Sending...' : 'Отправка...')
                : (lang === 'en' ? 'Send Invite' : 'Отправить приглашение')}
            </button>
          </motion.div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="bg-card border border-border/50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary/70 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 rounded-full bg-secondary/70" />
                    <div className="h-2.5 w-48 rounded-full bg-secondary/50" />
                  </div>
                  <div className="h-5 w-12 rounded-lg bg-secondary/60 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <p className="text-muted-foreground text-sm">{lang === 'en' ? 'No clients yet' : 'Пока нет клиентов'}</p>
        ) : (
          <>
          {/* Active / Archive top tabs */}
          <div className="flex gap-1 mb-3 p-1 bg-secondary/40 rounded-xl">
            <button
              onClick={() => { setArchiveView('active'); setSelectedClient(null); }}
              className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${
                archiveView === 'active'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {lang === 'en' ? 'Active' : 'Активные'}
            </button>
            <button
              onClick={() => { setArchiveView('archived'); setSelectedClient(null); }}
              className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                archiveView === 'archived'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {lang === 'en' ? 'Archive' : 'Архив'}
              {archivedCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                  archiveView === 'archived' ? 'bg-primary-foreground/20' : 'bg-secondary'
                }`}>
                  {archivedCount}
                </span>
              )}
            </button>
          </div>

          {/* Search + filter bar */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Search clients...' : 'Поиск клиентов...'}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl pl-9 pr-9 py-2.5 text-xs focus:outline-none focus:border-primary/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {(['all', 'active', 'inactive'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterActive(f)}
                  className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-colors ${
                    filterActive === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f === 'all'
                    ? (lang === 'en' ? 'All' : 'Все')
                    : f === 'active'
                    ? (lang === 'en' ? 'Active pkg' : 'С пакетом')
                    : (lang === 'en' ? 'No pkg' : 'Без пакета')}
                </button>
              ))}
            </div>
            {(searchQuery || filterActive !== 'all') && (
              <p className="text-[11px] text-muted-foreground text-center">
                {lang === 'en' ? `${filteredClientOrder.length} found` : `Найдено: ${filteredClientOrder.length}`}
              </p>
            )}
          </div>

          <Reorder.Group axis="y" values={clientOrder} onReorder={handleReorder} className="space-y-3">
            {filteredClientOrder.map((userId) => {
              const client = clients.find(c => c.user_id === userId);
              if (!client) return null;
              const isOpen = selectedClient === client.user_id;
              const clientPkgs = packages[client.user_id] || [];

              return (
                <DraggableClientRow key={userId} value={userId} disabled={isOpen}>
                {(dragHandle) => (
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                  <div className="w-full p-4 flex items-center gap-3">
                     <div onPointerDown={dragHandle.onPointerDown} className="touch-none">
                       <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
                     </div>
                     {client.avatar_url ? (
                       <img
                         src={client.avatar_url}
                         alt={client.full_name}
                         className="w-9 h-9 rounded-full object-cover shrink-0"
                       />
                     ) : (
                       <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                         <span className="text-xs font-bold text-primary">
                           {client.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                         </span>
                       </div>
                     )}
                     <button
                       onClick={() => setSelectedClient(isOpen ? null : client.user_id)}
                       className="flex-1 text-left flex items-center justify-between min-w-0"
                     >
                       <div className="min-w-0">
                         <p className="font-bold text-sm truncate">{client.full_name}</p>
                         <p className="text-[11px] text-muted-foreground truncate">{client.email} · {client.phone}</p>
                       </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {(() => {
                          const count = weeklySessionCounts[client.user_id] || 0;
                          return (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-0.5 ${
                              count > 0
                                ? 'bg-secondary text-muted-foreground'
                                : 'bg-secondary/40 text-muted-foreground/40'
                            }`}>
                              <Clock className="w-2.5 h-2.5" />
                              {count}/{lang === 'en' ? 'wk' : 'нед'}
                            </span>
                          );
                        })()}
                         {(() => {
                           const activePkg = clientPkgs.find((p) => p.is_active);
                           if (!activePkg) {
                             // No active package — check if they ever had one
                             const hadPackage = clientPkgs.length > 0;
                             if (hadPackage) {
                               return (
                                 <span className="text-xs bg-destructive/15 text-destructive px-2 py-1 rounded-lg font-semibold">
                                   0
                                 </span>
                               );
                             }
                             return (
                               <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-1 rounded-lg font-semibold">
                                 {lang === 'en' ? 'per session' : 'разовая'}
                               </span>
                             );
                           }
                           const remaining = activePkg.total_sessions - activePkg.used_sessions;
                           // Unlimited: total_sessions >= 999
                           if (activePkg.total_sessions >= 999) {
                             return (
                               <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-lg font-semibold">
                                 ∞
                               </span>
                             );
                           }
                           if (remaining <= 0) {
                             return (
                               <span className="text-xs bg-destructive/15 text-destructive px-2 py-1 rounded-lg font-semibold">
                                 0
                               </span>
                             );
                           }
                           return (
                             <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-lg font-semibold">
                               {remaining} {lang === 'en' ? 'left' : 'ост.'}
                             </span>
                           );
                         })()}
                      </div>
                    </button>
                  </div>

                  {isOpen && (
                    <ClientDetailAccordion
                      client={client}
                      clientPkgs={clientPkgs}
                      lang={lang}
                      onSessionChange={fetchData}
                      onAddSession={addSession}
                      onDeletePackage={deletePackage}
                      onCreatePackage={(userId, sessions, pricePaid) => {
                        supabase.from('client_packages').insert({
                          user_id: userId,
                          package_name: `${sessions} ${lang === 'en' ? 'sessions' : 'занятий'}`,
                          total_sessions: sessions,
                          price_paid: pricePaid,
                        }).then(() => {
                          fetchData();
                          toast({ title: lang === 'en' ? 'Package created' : 'Пакет создан' });
                        });
                      }}
                      onSendRemaining={() => sendRemainingNotification(client)}
                      onSendRenewal={() => sendRenewalNotification(client)}
                      onSendGymRenewal={() => sendGymRenewalNotification(client)}
                      onDeleteClient={() => deleteClient(client)}
                      onArchiveClient={() => archiveClient(client)}
                      onUnarchiveClient={() => unarchiveClient(client)}
                      onSendReactivation={() => sendReactivationOffer(client)}
                    />
                  )}
                </div>
                )}
                </DraggableClientRow>
              );
            })}
          </Reorder.Group>
          </>
        )}
        </div>
        )}
      </div>
    </section>
  );
};

export default AdminSection;
