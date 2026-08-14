import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User as UserIcon, Camera, Loader2, KeyRound, Eye, EyeOff, ClipboardCheck,
  ChevronRight, LogOut, Phone, Ruler, Cake, HeartPulse, BookOpen, Globe, Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface ClientSettingsProps {
  userId: string;
  avatarUrl: string | null;
  onAvatarChange: (url: string) => void;
  testsCount: number;
  lastTestPct: number | null;
  onOpenTests: () => void;
  onOpenCalcInfo: () => void;
  onSignOut: () => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2 px-1">{title}</p>
    <div className="bg-card border border-border/40 rounded-2xl divide-y divide-border/30 overflow-hidden">
      {children}
    </div>
  </div>
);

const Row = ({
  icon, label, value, onClick, danger, children,
}: {
  icon?: React.ReactNode; label: string; value?: string; onClick?: () => void; danger?: boolean; children?: React.ReactNode;
}) => {
  const content = (
    <div className="flex items-center gap-3 px-4 py-3.5 w-full text-left">
      {icon && <span className={`shrink-0 ${danger ? 'text-destructive' : 'text-primary'}`}>{icon}</span>}
      <span className={`text-sm font-medium flex-1 ${danger ? 'text-destructive' : 'text-foreground'}`}>{label}</span>
      {value && <span className="text-xs text-muted-foreground truncate max-w-[45%]">{value}</span>}
      {children}
      {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
    </div>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="w-full hover:bg-secondary/30 transition-colors">{content}</button>
  ) : (
    <div>{content}</div>
  );
};

const ClientSettings = ({
  userId, avatarUrl, onAvatarChange, testsCount, lastTestPct, onOpenTests, onOpenCalcInfo, onSignOut,
}: ClientSettingsProps) => {
  const { profile, refreshProfile } = useAuth();
  const { lang, setLang } = useLanguage();
  const { toast } = useToast();
  const en = lang === 'en';

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // ── Profile fields ──
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [editBody, setEditBody] = useState(false);

  // ── Password ──
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [pwdVisible, setPwdVisible] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone, height_cm, birth_date, gender, preferred_language')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      setFullName(data?.full_name || '');
      setPhone(data?.phone || '');
      setHeightCm((data as any)?.height_cm ? String((data as any).height_cm) : '');
      setBirthDate((data as any)?.birth_date || '');
      setGender((data as any)?.gender || '');
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const age = birthDate
    ? Math.floor((Date.now() - new Date(birthDate + 'T12:00:00').getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const saveProfile = async () => {
    if (!fullName.trim()) {
      toast({ title: en ? 'Name cannot be empty' : 'Имя не может быть пустым', variant: 'destructive' });
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim().slice(0, 100), phone: phone.trim().slice(0, 30) })
      .eq('user_id', userId);
    setSavingProfile(false);
    if (error) {
      toast({ title: en ? 'Save failed' : 'Не удалось сохранить', description: error.message, variant: 'destructive' });
      return;
    }
    await refreshProfile();
    setEditProfile(false);
    toast({ title: en ? 'Profile updated' : 'Профиль обновлён' });
  };

  const saveBody = async () => {
    const h = heightCm ? Math.round(parseFloat(heightCm)) : null;
    if (h != null && (isNaN(h) || h < 100 || h > 250)) {
      toast({ title: en ? 'Height must be 100–250 cm' : 'Рост должен быть 100–250 см', variant: 'destructive' });
      return;
    }
    if (birthDate) {
      const y = new Date(birthDate + 'T12:00:00').getFullYear();
      if (isNaN(y) || y < 1920 || y > new Date().getFullYear() - 10) {
        toast({ title: en ? 'Invalid birth date' : 'Некорректная дата рождения', variant: 'destructive' });
        return;
      }
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ height_cm: h, birth_date: birthDate || null, gender: gender || null })
      .eq('user_id', userId);
    setSavingProfile(false);
    if (error) {
      toast({ title: en ? 'Save failed' : 'Не удалось сохранить', description: error.message, variant: 'destructive' });
      return;
    }
    setEditBody(false);
    toast({
      title: en ? 'Saved' : 'Сохранено',
      description: en ? 'Used for calorie & macro targets' : 'Используется для расчёта калорий и БЖУ',
    });
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: en ? 'File too large (max 5MB)' : 'Файл слишком большой (макс. 5МБ)', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', userId);
      onAvatarChange(url);
      await refreshProfile();
      toast({ title: en ? 'Photo updated!' : 'Фото обновлено!' });
    } catch (err: any) {
      toast({ title: en ? 'Upload failed' : 'Ошибка загрузки', description: err.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const changePassword = async () => {
    if (newPwd.length < 8) {
      toast({ title: en ? 'Min 8 characters' : 'Минимум 8 символов', variant: 'destructive' });
      return;
    }
    if (newPwd !== newPwd2) {
      toast({ title: en ? 'Passwords do not match' : 'Пароли не совпадают', variant: 'destructive' });
      return;
    }
    setPwdSaving(true);
    try {
      // Re-authenticate with the current password before changing it.
      if (profile?.email && currentPwd) {
        const { error: reauthErr } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password: currentPwd,
        });
        if (reauthErr) throw new Error(en ? 'Current password is incorrect' : 'Текущий пароль неверный');
      }
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { action: 'change_password', new_password: newPwd },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      toast({ title: en ? 'Password updated' : 'Пароль обновлён' });
      setCurrentPwd(''); setNewPwd(''); setNewPwd2(''); setPwdOpen(false);
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast({
        title: en ? 'Failed to update password' : 'Не удалось обновить пароль',
        description: msg.toLowerCase().includes('pwned') || msg.toLowerCase().includes('breach')
          ? (en ? 'This password was found in a breach. Choose another.' : 'Этот пароль скомпрометирован. Выберите другой.')
          : msg,
        variant: 'destructive',
      });
    }
    setPwdSaving(false);
  };

  const initials = (() => {
    const parts = (profile?.full_name || fullName || '').trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (profile?.full_name || fullName || '?').slice(0, 2).toUpperCase();
  })();

  const inputCls = 'w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary';

  return (
    <div>
      {/* ── Profile card ── */}
      <div className="bg-card border border-border/40 rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/60 cursor-pointer active:scale-95 transition-transform"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={en ? 'Profile photo' : 'Фото профиля'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full gradient-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-extrabold">{initials}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label={en ? 'Change photo' : 'Сменить фото'}
              className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" /> : <Camera className="w-3.5 h-3.5 text-primary-foreground" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-foreground truncate">{profile?.full_name || fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            {phone && <p className="text-xs text-muted-foreground truncate">{phone}</p>}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {editProfile && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-2">
                <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} placeholder={en ? 'Full name' : 'Имя и фамилия'} />
                <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder={en ? 'Phone' : 'Телефон'} inputMode="tel" />
                <div className="flex gap-2">
                  <button onClick={() => setEditProfile(false)} className="flex-1 text-xs font-semibold py-2 rounded-lg border border-border/50">
                    {en ? 'Cancel' : 'Отмена'}
                  </button>
                  <button onClick={saveProfile} disabled={savingProfile} className="flex-1 text-xs font-bold py-2 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {savingProfile && <Loader2 className="w-3 h-3 animate-spin" />}{en ? 'Save' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!editProfile && (
          <button
            onClick={() => setEditProfile(true)}
            className="mt-3 w-full text-xs font-bold py-2.5 rounded-xl border border-border/50 hover:bg-secondary/40 transition-colors flex items-center justify-center gap-1.5"
          >
            <UserIcon className="w-3.5 h-3.5" />{en ? 'Edit profile' : 'Редактировать профиль'}
          </button>
        )}
      </div>

      {/* ── Account ── */}
      <Section title={en ? 'Account' : 'Аккаунт'}>
        <div>
          <Row
            icon={<Cake className="w-4 h-4" />}
            label={en ? 'Personal data' : 'Личные данные'}
            value={loaded ? [
              heightCm ? `${heightCm} ${en ? 'cm' : 'см'}` : null,
              age != null ? `${age} ${en ? 'y.o.' : 'лет'}` : null,
              gender ? (gender === 'male' ? (en ? 'M' : 'М') : (en ? 'F' : 'Ж')) : null,
            ].filter(Boolean).join(' · ') || (en ? 'Not set' : 'Не указано') : ''}
            onClick={() => setEditBody(v => !v)}
          />
          <AnimatePresence initial={false}>
            {editBody && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4 space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Ruler className="w-3 h-3" />{en ? 'Height, cm' : 'Рост, см'}</label>
                  <input className={inputCls} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="numeric" placeholder="175" />
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{en ? 'Birth date' : 'Дата рождения'}</label>
                  <input className={inputCls} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{en ? 'Gender' : 'Пол'}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ v: 'male', en: 'Male', ru: 'Мужской' }, { v: 'female', en: 'Female', ru: 'Женский' }].map(g => (
                      <button
                        key={g.v}
                        onClick={() => setGender(g.v)}
                        className={`text-xs font-semibold py-2 rounded-lg border transition-colors ${gender === g.v ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground'}`}
                      >
                        {en ? g.en : g.ru}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {en ? 'Used to calculate your calorie and macro targets.' : 'Используется для расчёта нормы калорий и БЖУ.'}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditBody(false)} className="flex-1 text-xs font-semibold py-2 rounded-lg border border-border/50">{en ? 'Cancel' : 'Отмена'}</button>
                    <button onClick={saveBody} disabled={savingProfile} className="flex-1 text-xs font-bold py-2 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-1.5 disabled:opacity-50">
                      {savingProfile && <Loader2 className="w-3 h-3 animate-spin" />}{en ? 'Save' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <Row icon={<KeyRound className="w-4 h-4" />} label={en ? 'Change password' : 'Сменить пароль'} onClick={() => setPwdOpen(v => !v)} />
          <AnimatePresence initial={false}>
            {pwdOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4 space-y-2">
                  <input
                    className={inputCls}
                    type={pwdVisible ? 'text' : 'password'}
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder={en ? 'Current password' : 'Текущий пароль'}
                    autoComplete="current-password"
                  />
                  <div className="relative">
                    <input
                      className={inputCls + ' pr-9'}
                      type={pwdVisible ? 'text' : 'password'}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder={en ? 'New password (min 8)' : 'Новый пароль (мин. 8)'}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setPwdVisible(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {pwdVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <input
                    className={inputCls}
                    type={pwdVisible ? 'text' : 'password'}
                    value={newPwd2}
                    onChange={(e) => setNewPwd2(e.target.value)}
                    placeholder={en ? 'Repeat new password' : 'Повторите новый пароль'}
                    autoComplete="new-password"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {en ? 'Forgot it? Ask your trainer — a code is sent via Telegram.' : 'Забыли пароль? Напишите тренеру — код придёт в Telegram.'}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setPwdOpen(false); setCurrentPwd(''); setNewPwd(''); setNewPwd2(''); }} className="flex-1 text-xs font-semibold py-2 rounded-lg border border-border/50">
                      {en ? 'Cancel' : 'Отмена'}
                    </button>
                    <button
                      onClick={changePassword}
                      disabled={pwdSaving || newPwd.length < 8 || newPwd !== newPwd2 || !currentPwd}
                      className="flex-1 text-xs font-bold py-2 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {pwdSaving && <Loader2 className="w-3 h-3 animate-spin" />}{en ? 'Update' : 'Обновить'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Row icon={<Globe className="w-4 h-4" />} label={en ? 'Language' : 'Язык'}>
          <div className="flex gap-1.5">
            {(['en', 'ru'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${lang === l ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground'}`}
              >
                {l.toUpperCase()}
                {lang === l && <Check className="w-3 h-3 inline ml-1" />}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      {/* ── Health ── */}
      <Section title={en ? 'Health' : 'Здоровье'}>
        <Row
          icon={<ClipboardCheck className="w-4 h-4" />}
          label={en ? 'Health tests' : 'Тесты здоровья'}
          value={testsCount > 0
            ? `${testsCount} ${en ? 'taken' : 'пройдено'}${lastTestPct != null ? ` · ${lastTestPct}%` : ''}`
            : (en ? 'Not taken' : 'Не пройдены')}
          onClick={onOpenTests}
        />
        <Row
          icon={<HeartPulse className="w-4 h-4" />}
          label={en ? 'How we calculate calories' : 'Как мы считаем калории'}
          onClick={onOpenCalcInfo}
        />
      </Section>

      {/* ── Support ── */}
      <Section title={en ? 'Support' : 'Поддержка'}>
        <a href="https://wa.me/35795144819" target="_blank" rel="noopener noreferrer" className="block hover:bg-secondary/30 transition-colors no-underline">
          <Row icon={<Phone className="w-4 h-4" />} label="WhatsApp" value="+357 95 144 819" />
        </a>
        <a href="https://t.me/+35795144819" target="_blank" rel="noopener noreferrer" className="block hover:bg-secondary/30 transition-colors no-underline">
          <Row icon={<Phone className="w-4 h-4" />} label="Telegram" value="@LimassolFitness" />
        </a>
        <Row
          icon={<BookOpen className="w-4 h-4" />}
          label={en ? 'Replay app guide & hints' : 'Показать гайд и подсказки заново'}
          onClick={() => {
            try {
              Object.keys(localStorage)
                .filter(k => k.startsWith('hint_seen_') || k === 'app_guide_v2_seen' || k === 'tier_badge_seen')
                .forEach(k => localStorage.removeItem(k));
            } catch { /* ignore */ }
            toast({ title: en ? 'Hints reset' : 'Подсказки сброшены', description: en ? 'They will show again as you browse.' : 'Они снова появятся при просмотре.' });
          }}
        />
      </Section>

      {/* ── Sign out ── */}
      <button
        onClick={onSignOut}
        className="w-full flex items-center justify-center gap-2 text-sm font-bold text-destructive py-3.5 rounded-2xl border border-destructive/30 hover:bg-destructive/10 transition-colors"
      >
        <LogOut className="w-4 h-4" />{en ? 'Sign out' : 'Выйти'}
      </button>
    </div>
  );
};

export default ClientSettings;
