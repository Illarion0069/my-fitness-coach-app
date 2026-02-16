import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, LogIn, X, Loader2, Bot, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useToast } from '@/hooks/use-toast';
import CountryCodeSelect from './CountryCodeSelect';
import trainerLogo from '@/assets/trainer-logo.png';

type Step = 'welcome' | 'register' | 'login' | 'telegram';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

const InlineMessage = ({ message, variant = 'error' }: { message: string | null; variant?: 'error' | 'success' }) => {
  if (!message) return null;
  return (
    <p className={`text-xs px-1 py-2 rounded-lg text-center ${
      variant === 'success' ? 'text-green-400 bg-green-500/10' : 'text-destructive bg-destructive/10'
    }`}>
      {message}
    </p>
  );
};

const PasswordInput = ({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder: string; className: string;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        maxLength={128}
        autoComplete="current-password"
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

/** Convert phone to a fake email for Supabase auth */
const phoneToEmail = (countryCode: string, phone: string) => {
  const digits = `${countryCode}${phone}`.replace(/[^0-9]/g, '');
  return `${digits}@phone.fitness.local`;
};

const WelcomeModal = ({ open, onClose }: WelcomeModalProps) => {
  const { lang } = useLanguage();
  const { refreshProfile, profile } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('welcome');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+357');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginCountryCode, setLoginCountryCode] = useState('+357');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep('welcome');
      setFormError(null);
    }
  }, [open]);

  const t = (en: string, ru: string) => lang === 'en' ? en : ru;

  const getRegisterErrors = (): string | null => {
    if (!name.trim()) return t('Please enter your name', 'Введите ваше имя');
    if (!phoneNumber.trim() || phoneNumber.length < 5) return t('Please enter a valid phone number', 'Введите корректный номер телефона');
    if (password.length < 6) return t('Password must be at least 6 characters', 'Пароль минимум 6 символов');
    return null;
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setFormError(null);
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) setFormError(error.message);
    setSubmitting(false);
  };

  const handleRegister = async () => {
    setFormError(null);
    const validationError = getRegisterErrors();
    if (validationError) { setFormError(validationError); return; }
    setSubmitting(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const fakeEmail = phoneToEmail(countryCode, phoneNumber);
      const { error } = await supabase.auth.signUp({
        email: fakeEmail,
        password,
        options: {
          data: { full_name: name.trim(), phone: fullPhone },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        if (error.message?.includes('already been registered')) {
          throw new Error(t('This phone number is already registered. Please sign in.', 'Этот номер уже зарегистрирован. Войдите в систему.'));
        }
        throw error;
      }
      await refreshProfile();
      toast({ title: t('Registration successful!', 'Регистрация успешна!') });

      // Non-blocking trainer notification
      supabase.functions.invoke('send-telegram', {
        body: {
          action: 'notifyRegistration',
          message: `🆕 <b>New Client Registered!</b>\n\n👤 ${name.trim()}\n📱 ${fullPhone}`,
        },
      }).catch(() => {});

      setStep('telegram');
    } catch (err: any) {
      setFormError(err.message);
    }
    setSubmitting(false);
  };

  const handleLogin = async () => {
    setFormError(null);
    if (!loginPhone.trim() || loginPhone.length < 5) {
      setFormError(t('Please enter a valid phone number', 'Введите корректный номер телефона'));
      return;
    }
    if (!loginPassword) {
      setFormError(t('Please enter your password', 'Введите пароль'));
      return;
    }
    setSubmitting(true);
    try {
      const fakeEmail = phoneToEmail(loginCountryCode, loginPhone);
      const { error } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: loginPassword,
      });
      if (error) throw error;
      await refreshProfile();
      toast({ title: t('Welcome back!', 'С возвращением!') });
      onClose();
    } catch (err: any) {
      if (err.message?.includes('Invalid login credentials')) {
        setFormError(t('Wrong phone number or password', 'Неверный номер или пароль'));
      } else {
        setFormError(err.message);
      }
    }
    setSubmitting(false);
  };

  if (!open) return null;

  const inputClass = "w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50";

  const googleButton = (
    <button
      onClick={handleGoogleSignIn}
      disabled={submitting}
      className="w-full bg-[hsl(0,0%,100%)] text-[hsl(0,0%,20%)] font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {t('Continue with Google', 'Войти через Google')}
    </button>
  );

  const divider = (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-border/50" />
      <span className="text-[10px] text-muted-foreground uppercase">{t('or', 'или')}</span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border/50 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="relative p-6 pb-4 text-center">
            <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <img src={trainerLogo} alt="Logo" className="w-12 h-12 rounded-2xl mx-auto mb-3" />
            <h3 className="text-lg font-extrabold font-heading uppercase tracking-tight">
              {step === 'welcome' ? t('Welcome!', 'Добро пожаловать!')
                : step === 'register' ? t('New Client', 'Новый клиент')
                : step === 'telegram' ? t('Stay Connected', 'Будьте на связи')
                : t('Welcome Back', 'С возвращением')}
            </h3>
            {step === 'welcome' && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('Personal fitness training in Limassol', 'Персональные фитнес-тренировки в Лимассоле')}
              </p>
            )}
          </div>

          <div className="px-6 pb-6">
            <AnimatePresence mode="wait">
              {/* Step: Welcome */}
              {step === 'welcome' && (
                <motion.div key="welcome" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                  <button onClick={() => { setStep('register'); setFormError(null); }} className="w-full bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-center gap-3 hover:bg-primary/20 transition-all text-left">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                      <UserPlus className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{t("I'm a new client", 'Я новый клиент')}</p>
                      <p className="text-[11px] text-muted-foreground">{t('Quick signup with phone & password', 'Быстрая регистрация по телефону')}</p>
                    </div>
                  </button>
                  <button onClick={() => { setStep('login'); setFormError(null); }} className="w-full bg-secondary/50 border border-border/50 rounded-2xl p-4 flex items-center gap-3 hover:bg-secondary transition-all text-left">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <LogIn className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{t("I'm already a client", 'Я уже клиент')}</p>
                      <p className="text-[11px] text-muted-foreground">{t('Sign in with phone & password', 'Войти по телефону и паролю')}</p>
                    </div>
                  </button>
                </motion.div>
              )}

              {/* Step: Register */}
              {step === 'register' && (
                <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                  <input type="text" placeholder={t('Full name', 'Полное имя')} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={100} />
                  <CountryCodeSelect
                    value={countryCode}
                    onChange={setCountryCode}
                    phoneNumber={phoneNumber}
                    onPhoneChange={setPhoneNumber}
                    placeholder={t('Phone number', 'Номер телефона')}
                  />
                  <PasswordInput value={password} onChange={setPassword} placeholder={t('Password (min 6 chars)', 'Пароль (мин 6 символов)')} className={inputClass} />

                  <InlineMessage message={formError} variant="error" />

                  <button
                    onClick={handleRegister}
                    disabled={submitting}
                    className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        {t('Sign Up', 'Зарегистрироваться')}
                      </>
                    )}
                  </button>

                  {divider}
                  {googleButton}

                  <button onClick={() => { setStep('welcome'); setFormError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors">
                    ← {t('Back', 'Назад')}
                  </button>
                </motion.div>
              )}

              {/* Step: Login */}
              {step === 'login' && (
                <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                  <CountryCodeSelect
                    value={loginCountryCode}
                    onChange={setLoginCountryCode}
                    phoneNumber={loginPhone}
                    onPhoneChange={setLoginPhone}
                    placeholder={t('Phone number', 'Номер телефона')}
                  />
                  <PasswordInput value={loginPassword} onChange={setLoginPassword} placeholder={t('Password', 'Пароль')} className={inputClass} />

                  <InlineMessage message={formError} variant="error" />

                  <button
                    onClick={handleLogin}
                    disabled={submitting}
                    className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <LogIn className="w-4 h-4" />
                        {t('Sign In', 'Войти')}
                      </>
                    )}
                  </button>

                  {divider}
                  {googleButton}

                  <button onClick={() => { setStep('welcome'); setFormError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors">
                    ← {t('Back', 'Назад')}
                  </button>
                </motion.div>
              )}

              {/* Step: Telegram */}
              {step === 'telegram' && (
                <motion.div key="telegram" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
                    <Bot className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'Tap the button below to connect Telegram — you\'ll receive training reminders automatically!',
                      'Нажмите кнопку ниже, чтобы подключить Telegram — вы будете получать напоминания автоматически!'
                    )}
                  </p>
                  <a
                    href={`https://t.me/LimassolFitness_bot?start=${profile?.telegram_link_code || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    <Bot className="w-4 h-4" />
                    {t('Connect Telegram', 'Подключить Telegram')}
                  </a>
                  <button onClick={onClose} className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors">
                    {t('Skip for now', 'Пропустить')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WelcomeModal;
