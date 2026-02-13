import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Package, LogOut, ExternalLink, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

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

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

const ProfileModal = ({ open, onClose }: ProfileModalProps) => {
  const { user, profile, isTrainer, signOut } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();

  if (!open || !user) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card w-full max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col border border-border/50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border/30">
              <div>
                <p className="font-extrabold font-heading text-lg">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {isTrainer ? <TrainerView /> : <ClientView />}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-border/30">
              <button
                onClick={async () => { await signOut(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground text-sm font-bold py-3 rounded-xl hover:bg-secondary/80 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {lang === 'en' ? 'Sign Out' : 'Выйти'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ─── Trainer View ─── */
const TrainerView = () => {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [clients, setClients] = useState<Profile[]>([]);
  const [packages, setPackages] = useState<Record<string, ClientPackage[]>>({});
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [newPkgTotal, setNewPkgTotal] = useState(8);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data: profileData } = await supabase.from('profiles').select('*');
    setClients(profileData || []);

    const { data: pkgData } = await supabase
      .from('client_packages')
      .select('*')
      .order('created_at', { ascending: false });

    const grouped: Record<string, ClientPackage[]> = {};
    (pkgData || []).forEach((p: ClientPackage) => {
      if (!grouped[p.user_id]) grouped[p.user_id] = [];
      grouped[p.user_id].push(p);
    });
    setPackages(grouped);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateSession = async (pkgId: string, delta: number) => {
    const allPkgs = Object.values(packages).flat();
    const pkg = allPkgs.find((p) => p.id === pkgId);
    if (!pkg) return;
    const newUsed = Math.max(0, Math.min(pkg.total_sessions, pkg.used_sessions + delta));
    await supabase.from('client_packages').update({ used_sessions: newUsed }).eq('id', pkgId);
    fetchData();
  };

  const createPackage = async (userId: string) => {
    const name = `${newPkgTotal} ${lang === 'en' ? 'sessions' : 'занятий'}`;
    await supabase.from('client_packages').insert({
      user_id: userId,
      package_name: name,
      total_sessions: newPkgTotal,
    });
    fetchData();
    toast({ title: lang === 'en' ? 'Package created' : 'Пакет создан' });
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {lang === 'en' ? 'Clients' : 'Клиенты'} ({clients.length})
      </p>

      {clients.map((client) => {
        const clientPkgs = packages[client.user_id] || [];
        const activePkg = clientPkgs.find((p) => p.is_active);
        const remaining = activePkg ? activePkg.total_sessions - activePkg.used_sessions : 0;
        const isOpen = expandedClient === client.user_id;

        return (
          <div key={client.id} className="bg-secondary/30 rounded-xl overflow-hidden border border-border/30">
            <button
              onClick={() => setExpandedClient(isOpen ? null : client.user_id)}
              className="w-full p-3 text-left flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{client.full_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{client.email}</p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                activePkg ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                {activePkg ? `${remaining}/${activePkg.total_sessions}` : '—'}
              </span>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-2 border-t border-border/20 pt-2">
                    {/* Active package controls */}
                    {activePkg && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSession(activePkg.id, -1)}
                          className="w-10 h-10 rounded-xl bg-secondary text-foreground flex items-center justify-center hover:bg-secondary/80 transition-colors"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <span className="flex-1 text-center text-sm font-bold">
                          {activePkg.used_sessions}/{activePkg.total_sessions}
                        </span>
                        <button
                          onClick={() => updateSession(activePkg.id, 1)}
                          className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    )}

                    {/* Add new package - free input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={newPkgTotal}
                        onChange={(e) => setNewPkgTotal(Math.max(1, Number(e.target.value)))}
                        className="w-20 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs text-center focus:outline-none focus:border-primary/50"
                      />
                      <span className="text-xs text-muted-foreground">{lang === 'en' ? 'sessions' : 'занятий'}</span>
                      <button
                        onClick={() => createPackage(client.user_id)}
                        className="ml-auto gradient-primary text-primary-foreground text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1"
                      >
                        <Package className="w-3 h-3" /> {lang === 'en' ? 'Add' : 'Добавить'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

/* ─── Client View ─── */
const ClientView = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [pkg, setPkg] = useState<ClientPackage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPkg = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('client_packages')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPkg(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPkg();

    if (!user) return;
    const channel = supabase
      .channel('profile-pkg')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_packages', filter: `user_id=eq.${user.id}` }, () => fetchPkg())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) return <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>;

  if (!pkg) {
    return (
      <div className="text-center py-6">
        <Activity className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">
          {lang === 'en' ? 'No active package yet' : 'Пока нет активного пакета'}
        </p>
        <BuyButton />
      </div>
    );
  }

  const remaining = pkg.total_sessions - pkg.used_sessions;
  const pct = Math.round((remaining / pkg.total_sessions) * 100);
  const low = remaining <= 2;

  return (
    <div className="space-y-4">
      <div className="bg-secondary/30 rounded-xl p-4 border border-border/30">
        <p className="text-xs text-muted-foreground mb-1">{pkg.package_name}</p>
        <p className="text-2xl font-extrabold font-heading">
          {remaining} <span className="text-sm font-normal text-muted-foreground">/ {pkg.total_sessions}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {lang === 'en' ? 'sessions remaining' : 'занятий осталось'}
        </p>
        <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${low ? 'bg-destructive' : 'gradient-primary'}`}
          />
        </div>
        {low && (
          <p className="text-xs text-destructive mt-2 font-semibold">
            {lang === 'en' ? '⚠️ Running low on sessions!' : '⚠️ Занятия заканчиваются!'}
          </p>
        )}
      </div>

      <BuyButton />
    </div>
  );
};

const BuyButton = () => {
  const { lang } = useLanguage();
  return (
    <a
      href="https://revolut.me/illarion"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 w-full gradient-primary text-primary-foreground text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity block text-center"
    >
      <ExternalLink className="w-4 h-4" />
      {lang === 'en' ? 'Buy More Sessions' : 'Купить ещё тренировки'}
    </a>
  );
};

export default ProfileModal;
