import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Minus, Send, Package, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [clients, setClients] = useState<Profile[]>([]);
  const [packages, setPackages] = useState<Record<string, ClientPackage[]>>({});
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgTotal, setNewPkgTotal] = useState(8);
  const [loading, setLoading] = useState(true);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [inviting, setInviting] = useState(false);

  const fetchData = async () => {
    const { data: profileData } = await supabase.from('profiles').select('*');
    setClients(profileData || []);

    const { data: pkgData } = await supabase.from('client_packages').select('*').order('created_at', { ascending: false });
    const grouped: Record<string, ClientPackage[]> = {};
    (pkgData || []).forEach((p: ClientPackage) => {
      if (!grouped[p.user_id]) grouped[p.user_id] = [];
      grouped[p.user_id].push(p);
    });
    setPackages(grouped);
    setLoading(false);
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

  const createPackage = async (userId: string) => {
    if (!newPkgName.trim()) return;
    await supabase.from('client_packages').insert({
      user_id: userId,
      package_name: newPkgName.trim(),
      total_sessions: newPkgTotal,
    });
    setNewPkgName('');
    setNewPkgTotal(8);
    fetchData();
    toast({ title: lang === 'en' ? 'Package created' : 'Пакет создан' });
  };

  const sendReminder = async (client: Profile) => {
    const clientPkgs = packages[client.user_id] || [];
    const activePkg = clientPkgs.find((p) => p.is_active);
    const remaining = activePkg ? activePkg.total_sessions - activePkg.used_sessions : 0;

    await supabase.functions.invoke('send-telegram', {
      body: {
        message: `📢 <b>Limassol Fitness</b>\n\n${client.full_name}, у вас осталось <b>${remaining}</b> занятий.\nПора продлить абонемент! 💪`,
      },
    });

    toast({
      title: lang === 'en' ? 'Reminder sent' : 'Напоминание отправлено',
      description: client.full_name,
    });
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
          <div className="space-y-3">
            {clients.map((client) => {
              const isOpen = selectedClient === client.user_id;
              const clientPkgs = packages[client.user_id] || [];

              return (
                <motion.div key={client.id} layout className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setSelectedClient(isOpen ? null : client.user_id)}
                    className="w-full p-4 text-left flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-sm">{client.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{client.email} · {client.phone}</p>
                    </div>
                    {clientPkgs.some((p) => p.is_active) && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-lg font-semibold">
                        {clientPkgs.find((p) => p.is_active)!.total_sessions - clientPkgs.find((p) => p.is_active)!.used_sessions} left
                      </span>
                    )}
                  </button>

                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="px-4 pb-4 space-y-3 border-t border-border/30"
                    >
                      {/* Active packages */}
                      {clientPkgs.filter((p) => p.is_active).map((pkg) => (
                        <div key={pkg.id} className="bg-secondary/50 rounded-xl p-3 mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold">{pkg.package_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {pkg.used_sessions}/{pkg.total_sessions}
                            </p>
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
                        <input
                          type="text"
                          placeholder={lang === 'en' ? 'Package name (e.g. 8 sessions)' : 'Название (напр. 8 занятий)'}
                          value={newPkgName}
                          onChange={(e) => setNewPkgName(e.target.value)}
                          className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
                        />
                        <div className="flex gap-2">
                          <select
                            value={newPkgTotal}
                            onChange={(e) => setNewPkgTotal(Number(e.target.value))}
                            className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none"
                          >
                            <option value={8}>8 {lang === 'en' ? 'sessions' : 'занятий'}</option>
                            <option value={12}>12 {lang === 'en' ? 'sessions' : 'занятий'}</option>
                            <option value={20}>20 {lang === 'en' ? 'sessions' : 'занятий'}</option>
                          </select>
                          <button
                            onClick={() => createPackage(client.user_id)}
                            disabled={!newPkgName.trim()}
                            className="gradient-primary text-primary-foreground text-xs font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                          >
                            {lang === 'en' ? 'Add' : 'Добавить'}
                          </button>
                        </div>
                      </div>

                      {/* Send reminder */}
                      <button
                        onClick={() => sendReminder(client)}
                        className="w-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
                      >
                        <Send className="w-3 h-3" /> {lang === 'en' ? 'Send Reminder' : 'Отправить напоминание'}
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminSection;
