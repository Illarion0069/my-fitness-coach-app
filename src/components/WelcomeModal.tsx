import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, LogIn, X, Loader2, Bot, Eye, EyeOff, KeyRound, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useToast } from '@/hooks/use-toast';
import CountryCodeSelect from './CountryCodeSelect';
import trainerLogo from '@/assets/trainer-logo.png';

type Step = 'welcome' | 'register' | 'login' | 'telegram' | 'forgot' | 'forgot-code' | 'forgot-done';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  consultationFlow?: boolean;
  onRegistered?: () => void;
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

const getPasswordStrength = (pw: string): number => {
  if (!pw) return 0;
  if (pw.length < 6) return 0;
  let score = 1;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

const PasswordChecklist = ({ password, lang }: { password: string; lang: string }) => {
  if (!password) return (
    <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
      {lang === 'en' ? 'At least 6 characters — letters, numbers, or symbols' : 'Минимум 6 символов — буквы, цифры или символы'}
    </p>
  );

  const t = (en: string, ru: string) => lang === 'en' ? en : ru;

  const checks = [
    { pass: password.length >= 6, label: t('At least 6 characters', 'Минимум 6 символов') },
    { pass: /[A-Z]/.test(password), label: t('Uppercase letter', 'Заглавная буква') },
    { pass: /[a-z]/.test(password), label: t('Lowercase letter', 'Строчная буква') },
    { pass: /[0-9]/.test(password), label: t('Number', 'Цифра') },
    { pass: /[^A-Za-z0-9]/.test(password), label: t('Symbol (!@#...)', 'Символ (!@#...)') },
  ];

  const strength = getPasswordStrength(password);
  const levels = [
    { label: t('Too short', 'Слишком короткий'), color: 'bg-destructive' },
    { label: t('Weak', 'Слабый'), color: 'bg-destructive' },
    { label: t('Fair', 'Средний'), color: 'bg-yellow-500' },
    { label: t('Good', 'Хороший'), color: 'bg-emerald-500' },
    { label: t('Strong', 'Сильный'), color: 'bg-emerald-400' },
  ];
  const { label: strengthLabel, color } = levels[strength];

  return (
    <div className="mt-2 px-1 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < strength ? color : 'bg-border/50'}`} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{strengthLabel}</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className={`text-[10px] ${c.pass ? 'text-emerald-500' : 'text-muted-foreground/50'}`}>
              {c.pass ? '✓' : '○'}
            </span>
            <span className={`text-[10px] ${c.pass ? 'text-foreground' : 'text-muted-foreground/60'}`}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Convert phone to a fake email for Supabase auth */
const phoneToEmail = (countryCode: string, phone: string) => {
  const digits = `${countryCode}${phone}`.replace(/[^0-9]/g, '');
  return `${digits}@phone.fitness.local`;
};

const WelcomeModal = ({ open, onClose, consultationFlow, onRegistered }: WelcomeModalProps) => {
  const { lang } = useLanguage();
  const { refreshProfile, profile, user, loading } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('welcome');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+357');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginCountryCode, setLoginCountryCode] = useState('+357');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAuthResolution, setPendingAuthResolution] = useState(false);

  // Forgot password state
  const [forgotCountryCode, setForgotCountryCode] = useState('+357');
  const [forgotPhone, setForgotPhone] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (open) {
      // In consultation flow, skip welcome and go straight to register
      setStep(consultationFlow ? 'register' : 'welcome');
      setFormError(null);
      setConfirmPassword('');
      setPendingAuthResolution(false);
    }
  }, [open, consultationFlow]);

  const t = (en: string, ru: string) => lang === 'en' ? en : ru;

  useEffect(() => {
    if (!pendingAuthResolution || loading || !user) return;
    setPendingAuthResolution(false);
    setSubmitting(false);
    toast({ title: lang === 'en' ? 'Welcome back!' : 'С возвращением!' });
    onClose();
  }, [pendingAuthResolution, loading, user, lang, toast, onClose]);

  const getRegisterErrors = (): string | null => {
    if (!name.trim()) return t('Please enter your name', 'Введите ваше имя');
    if (!phoneNumber.trim() || phoneNumber.length < 5) return t('Please enter a valid phone number', 'Введите корректный номер телефона');
    if (password.length < 6) return t('Password must be at least 6 characters', 'Пароль минимум 6 символов');
    if (password !== confirmPassword) return t('Passwords do not match', 'Пароли не совпадают');
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

      // Use admin signup edge function to bypass HaveIBeenPwned check
      const { data: fnData, error: fnError } = await supabase.functions.invoke('signup', {
        body: { email: fakeEmail, password, full_name: name.trim(), phone: fullPhone },
      });

      if (fnError) throw new Error(fnError.message || t('Registration failed', 'Ошибка регистрации'));
      if (fnData?.error) {
        if (fnData.error.includes('already registered')) {
          throw new Error(t('This phone number is already registered. Please sign in.', 'Этот номер уже зарегистрирован. Войдите в систему.'));
        }
        throw new Error(fnData.error);
      }

      // If we got a session back, set it; otherwise sign in manually
      if (fnData?.session) {
        await supabase.auth.setSession(fnData.session);
      } else {
        // Sign in with the newly created credentials
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
        if (signInErr) throw signInErr;
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

      // Trigger fullscreen onboarding instead of inline telegram step
      if (onRegistered) {
        onClose();
        onRegistered();
      } else {
        setStep('telegram');
      }
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
    setPendingAuthResolution(false);
    try {
      const fakeEmail = phoneToEmail(loginCountryCode, loginPhone);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: loginPassword,
      });
      if (error) throw error;

      const signedUserId = data.user?.id;
      if (signedUserId) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', signedUserId);
        const trainer = rolesData?.some((role) => role.role === 'trainer') ?? false;
        localStorage.setItem('user_role_hint', trainer ? 'trainer' : 'client');
      }

      setPendingAuthResolution(true);
    } catch (err: any) {
      if (err.message?.includes('Invalid login credentials')) {
        setFormError(t('Wrong phone number or password', 'Неверный номер или пароль'));
      } else {
        setFormError(err.message);
      }
      setPendingAuthResolution(false);
      setSubmitting(false);
    }
  };

  const handleForgotRequest = async () => {
    setFormError(null);
    if (!forgotPhone.trim() || forgotPhone.length < 5) {
      setFormError(t('Please enter a valid phone number', 'Введите корректный номер телефона'));
      return;
    }
    setSubmitting(true);
    try {
      const fullPhone = `${forgotCountryCode}${forgotPhone}`;
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { action: 'request_reset', phone: fullPhone },
      });
      if (error) throw error;
      if (data?.error === 'not_found') {
        throw new Error(t('Phone number not found', 'Номер телефона не найден'));
      }
      if (data?.error === 'no_telegram') {
        throw new Error(t('No Telegram linked to this account. Contact your trainer.', 'К аккаунту не привязан Telegram. Обратитесь к тренеру.'));
      }
      if (data?.error) throw new Error(data.error);
      setStep('forgot-code');
    } catch (err: any) {
      setFormError(err.message);
    }
    setSubmitting(false);
  };

  const handleForgotVerify = async () => {
    setFormError(null);
    if (!resetCode.trim() || resetCode.length !== 6) {
      setFormError(t('Enter the 6-digit code', 'Введите 6-значный код'));
      return;
    }
    if (newPassword.length < 8) {
      setFormError(t('Password must be at least 8 characters', 'Пароль минимум 8 символов'));
      return;
    }
    setSubmitting(true);
    try {
      const fullPhone = `${forgotCountryCode}${forgotPhone}`;
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { action: 'verify_and_reset', phone: fullPhone, code: resetCode, new_password: newPassword },
      });
      // Read structured error from response body even on non-2xx
      let payload: any = data;
      if (error && (error as any).context && typeof (error as any).context.json === 'function') {
        try { payload = await (error as any).context.json(); } catch {}
      } else if (error && !payload) {
        throw error;
      }
      if (payload?.error === 'invalid_code') {
        throw new Error(t('Invalid or expired code', 'Неверный или истёкший код'));
      }
      if (payload?.error === 'pwned_password') {
        throw new Error(t(
          'This password was found in known data breaches. Try a more unique one — add digits and a symbol.',
          'Этот пароль найден в утечках. Попробуйте уникальный — добавьте цифры и символ.'
        ));
      }
      if (payload?.error === 'weak_password') {
        throw new Error(t(
          'Password is too weak. Min 8 characters with letters, digits and a symbol.',
          'Пароль слишком слабый. Минимум 8 символов: буквы, цифры и символ.'
        ));
      }
      if (payload?.error) throw new Error(payload.message || payload.error);
      setStep('forgot-done');
    } catch (err: any) {
      setFormError(err.message);
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
                : step === 'forgot' ? t('Reset Password', 'Сброс пароля')
                : step === 'forgot-code' ? t('Enter Code', 'Введите код')
                : step === 'forgot-done' ? t('Password Updated', 'Пароль обновлён')
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
                  {consultationFlow && (
                    <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-center mb-1">
                      <p className="text-xs font-bold text-primary">
                        {t('✅ Payment received!', '✅ Оплата получена!')}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t('Create an account to book your consultation time slot', 'Создайте аккаунт, чтобы выбрать время для консультации')}
                      </p>
                  </div>
                  )}
                  <input type="text" placeholder={t('Full name', 'Полное имя')} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={100} />
                  <CountryCodeSelect
                    value={countryCode}
                    onChange={setCountryCode}
                    phoneNumber={phoneNumber}
                    onPhoneChange={setPhoneNumber}
                    placeholder={t('Phone number', 'Номер телефона')}
                  />
                  <div>
                    <PasswordInput value={password} onChange={setPassword} placeholder={t('Password', 'Пароль')} className={inputClass} />
                    <PasswordChecklist password={password} lang={lang} />
                  </div>
                  <div className="relative">
                    <PasswordInput
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder={t('Repeat password', 'Повторите пароль')}
                      className={`${inputClass} ${confirmPassword && confirmPassword !== password ? 'border-destructive/70' : confirmPassword && confirmPassword === password ? 'border-emerald-500/70' : ''}`}
                    />
                    {confirmPassword && (
                      <p className={`text-[11px] mt-1.5 px-1 ${confirmPassword === password ? 'text-emerald-400' : 'text-destructive'}`}>
                        {confirmPassword === password
                          ? t('✓ Passwords match', '✓ Пароли совпадают')
                          : t('Passwords do not match', 'Пароли не совпадают')}
                      </p>
                    )}
                  </div>

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

                  <button onClick={() => { setStep('forgot'); setFormError(null); setForgotCountryCode(loginCountryCode); setForgotPhone(loginPhone); }} className="w-full text-xs text-primary/70 hover:text-primary py-1 transition-colors">
                    {t('Forgot password?', 'Забыли пароль?')}
                  </button>
                  <button onClick={() => { setStep('welcome'); setFormError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors">
                    ← {t('Back', 'Назад')}
                  </button>
                </motion.div>
              )}

              {/* Step: Forgot Password — enter phone */}
              {step === 'forgot' && (
                <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                  <p className="text-xs text-muted-foreground text-center">
                    {t('Enter your phone number. We\'ll send a reset code to your Telegram.', 'Введите номер телефона. Мы отправим код сброса в ваш Telegram.')}
                  </p>
                  <CountryCodeSelect
                    value={forgotCountryCode}
                    onChange={setForgotCountryCode}
                    phoneNumber={forgotPhone}
                    onPhoneChange={setForgotPhone}
                    placeholder={t('Phone number', 'Номер телефона')}
                  />

                  <InlineMessage message={formError} variant="error" />

                  <button
                    onClick={handleForgotRequest}
                    disabled={submitting}
                    className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        {t('Send Code', 'Отправить код')}
                      </>
                    )}
                  </button>
                  <button onClick={() => { setStep('login'); setFormError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors">
                    ← {t('Back to login', 'Назад к входу')}
                  </button>
                </motion.div>
              )}

              {/* Step: Forgot Code — enter code + new password */}
              {step === 'forgot-code' && (
                <motion.div key="forgot-code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                  <p className="text-xs text-muted-foreground text-center">
                    {t('Check your Telegram for the 6-digit code.', 'Проверьте Telegram — мы отправили 6-значный код.')}
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={t('6-digit code', '6-значный код')}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={inputClass + ' text-center text-lg tracking-[0.3em] font-bold'}
                    maxLength={6}
                  />
                  <div>
                    <PasswordInput value={newPassword} onChange={setNewPassword} placeholder={t('New password', 'Новый пароль')} className={inputClass} />
                    <PasswordChecklist password={newPassword} lang={lang} />
                  </div>

                  <InlineMessage message={formError} variant="error" />

                  <button
                    onClick={handleForgotVerify}
                    disabled={submitting}
                    className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        {t('Reset Password', 'Сбросить пароль')}
                      </>
                    )}
                  </button>
                  <button onClick={() => { setStep('forgot'); setFormError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors">
                    ← {t('Back', 'Назад')}
                  </button>
                </motion.div>
              )}

              {/* Step: Forgot Done */}
              {step === 'forgot-done' && (
                <motion.div key="forgot-done" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('Your password has been updated. You can now sign in.', 'Пароль обновлён. Теперь вы можете войти.')}
                  </p>
                  <button
                    onClick={() => { setStep('login'); setFormError(null); }}
                    className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    <LogIn className="w-4 h-4" />
                    {t('Sign In', 'Войти')}
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
