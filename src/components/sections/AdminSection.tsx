import { useEffect, useState, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import { Users, Plus, Minus, Send, Package, UserPlus, LogOut, Trash2, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import SwipeableClientCard from '@/components/SwipeableClientCard';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
}

interface ClientPackage {
  id: string;
  user_id: string;
  package_name: string;
  total_sessions: number;
  used_sessions: number;
  is_active: boolean;
}

const AdminSection = () => {
  const { lang } = useLanguage();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Profile[]>([]);
  const [clientOrder, setClientOrder] = useState<string[]>([]);
  const [packages, setPackages] = useState<Record<string, ClientPackage[]>>({});
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [newPkgName, setNewPkgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [inviting, setInviting] = useState(false);

  const fetchData = async () => {
    const [{ data: profileData }, { data: pkgData }, { data: orderData }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('client_packages').select('*').order('created_at', { ascending: false }),
      supabase.from('trainer_client_order').select('*').limit(1).maybeSingle(),
    ]);

    const fetched = (profileData || []) as Profile[];
    setClients(fetched);

    const savedOrder: string[] = (orderData as any)?.client_order || [];
    const existingIds = new Set(savedOrder);
    const newIds = fetched.map(c => c.user_id).filter(id => !existingIds.has(id));
    const validIds = savedOrder.filter(id => fetched.some(c => c.user_id === id));
    setClientOrder([...validIds, ...newIds]);

    const grouped: Record<string, ClientPackage[]> = {};
    ((pkgData || []) as ClientPackage[]).forEach((p) => {
      if (!grouped[p.user_id]) grouped[p.user_id] = [];
      grouped[p.user_id].push(p);
    });
    setPackages(grouped);
    setLoading(false);
  };

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

  useEffect(() => { fetchData(); }, []);

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

  const createPackage = async (userId: string) => {
    const name = newPkgName.trim();
    if (!name) return;
    const parsed = parseInt(name, 10);
    const total = parsed > 0 ? parsed : 0;
    if (total <= 0) {
      toast({ title: lang === 'en' ? 'Enter a number' : 'Введите число', variant: 'destructive' });
      return;
    }
    await supabase.from('client_packages').insert({
      user_id: userId,
      package_name: `${total} ${lang === 'en' ? 'sessions' : 'занятий'}`,
      total_sessions: total,
    });
    setNewPkgName('');
    fetchData();
    toast({ title: lang === 'en' ? 'Package created' : 'Пакет создан' });
  };

  const deleteClient = async (client: Profile) => {
    await supabase.from('client_packages').delete().eq('user_id', client.user_id);
    await supabase.from('profiles').delete().eq('user_id', client.user_id);
    fetchData();
    toast({ title: lang === 'en' ? 'Client deleted' : 'Клиент удалён', description: client.full_name });
  };


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
    return sendNotification(client, `📊 <b>Limassol Fitness</b>\n\n${client.full_name}, у вас осталось <b>${remaining}</b> занятий из ${activePkg?.total_sessions || 0}.\nЗаписывайтесь на следующую тренировку! 💪`);
  };

  const sendRenewalNotification = (client: Profile) => {
    return sendNotification(client, `🔄 <b>Limassol Fitness</b>\n\n${client.full_name}, пора продлить абонемент!\n\n📦 Пакеты:\n• 8 занятий — 750€\n• 12 занятий — 1030€\n• 20 занятий — 1599€\n\nОплата: <a href="https://revolut.me/illarion">Revolut</a>\nНапишите тренеру для продления! 💪`);
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

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;

  return (
    <section className="min-h-screen bg-background p-5 pb-24">
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

        {clients.length === 0 ? (
          <p className="text-muted-foreground text-sm">{lang === 'en' ? 'No clients yet' : 'Пока нет клиентов'}</p>
        ) : (
          <Reorder.Group axis="y" values={clientOrder} onReorder={handleReorder} className="space-y-3">
            {clientOrder.map((userId) => {
              const client = clients.find(c => c.user_id === userId);
              if (!client) return null;
              const isOpen = selectedClient === client.user_id;
              const clientPkgs = packages[client.user_id] || [];

              return (
                <Reorder.Item key={userId} value={userId} dragListener={!isOpen}>
                <SwipeableClientCard onDelete={() => deleteClient(client)} clientName={client.full_name} lang={lang} disabled={isOpen}>
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                  <div className="w-full p-4 flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
                    <button
                      onClick={() => setSelectedClient(isOpen ? null : client.user_id)}
                      className="flex-1 text-left flex items-center justify-between min-w-0"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{client.full_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{client.email} · {client.phone}</p>
                      </div>
                      {clientPkgs.some((p) => p.is_active) && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-lg font-semibold shrink-0 ml-2">
                          {clientPkgs.find((p) => p.is_active)!.total_sessions - clientPkgs.find((p) => p.is_active)!.used_sessions} left
                        </span>
                      )}
                    </button>
                  </div>

                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="px-4 pb-4 space-y-3 border-t border-border/30"
                    >
                      {/* Client contact info */}
                      <div className="bg-secondary/30 rounded-xl p-3 mt-3 space-y-1.5">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                          {lang === 'en' ? 'Contact Info' : 'Контакты'}
                        </p>
                        <p className="text-xs text-foreground">{client.full_name}</p>
                        <p className="text-xs text-muted-foreground">{client.email}</p>
                        <p className="text-xs text-muted-foreground">{client.phone || (lang === 'en' ? 'No phone' : 'Нет телефона')}</p>
                      </div>

                      {/* Active packages */}
                      {clientPkgs.filter((p) => p.is_active).map((pkg) => (
                        <div key={pkg.id} className="bg-secondary/50 rounded-xl p-3 mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold">{pkg.package_name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">
                                {pkg.used_sessions}/{pkg.total_sessions}
                              </p>
                              <button
                                onClick={() => deletePackage(pkg.id)}
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
                              onClick={() => addSession(pkg.id, 1)}
                              className="flex-1 bg-primary/20 text-primary text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-primary/30 transition-colors"
                            >
                              <Plus className="w-3 h-3" /> {lang === 'en' ? 'Used' : 'Израсходовано'}
                            </button>
                            <button
                              onClick={() => addSession(pkg.id, -1)}
                              className="flex-1 bg-secondary text-foreground text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-secondary/80 transition-colors"
                            >
                              <Minus className="w-3 h-3" /> {lang === 'en' ? 'Undo' : 'Отмена'}
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Add package */}
                      <div className="bg-secondary/30 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-semibold flex items-center gap-1">
                          <Package className="w-3 h-3" /> {lang === 'en' ? 'New Package' : 'Новый пакет'}
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={1}
                            placeholder={lang === 'en' ? 'Number of sessions' : 'Количество занятий'}
                            value={newPkgName}
                            onChange={(e) => setNewPkgName(e.target.value)}
                            className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
                          />
                          <button
                            onClick={() => createPackage(client.user_id)}
                            disabled={!newPkgName.trim()}
                            className="gradient-primary text-primary-foreground text-xs font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                          >
                            {lang === 'en' ? 'Add' : 'Добавить'}
                          </button>
                        </div>
                      </div>

                      {/* Send notifications */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => sendRemainingNotification(client)}
                          className="flex-1 bg-primary/10 border border-primary/30 text-primary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 hover:bg-primary/20 transition-colors"
                        >
                          <Send className="w-3 h-3" /> {lang === 'en' ? 'Remaining' : 'Остаток'}
                        </button>
                        <button
                          onClick={() => sendRenewalNotification(client)}
                          className="flex-1 bg-accent/10 border border-accent/30 text-accent-foreground text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 hover:bg-accent/20 transition-colors"
                        >
                          <Send className="w-3 h-3" /> {lang === 'en' ? 'Renewal' : 'Продление'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
                </SwipeableClientCard>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        )}
      </div>
    </section>
  );
};

export default AdminSection;
