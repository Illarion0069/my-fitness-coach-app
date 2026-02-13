import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, LogIn, X, Loader2, Bot } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useToast } from '@/hooks/use-toast';

type Step = 'welcome' | 'register' | 'login' | 'telegram';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

const WelcomeModal = ({ open, onClose }: WelcomeModalProps) => {
  const { lang } = useLanguage();
  const { refreshProfile } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('welcome');

  // Reset step when modal opens
  useEffect(() => {
    if (open) {
      setStep('welcome');
    }
  }, [open]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({
        title: lang === 'en' ? 'Error' : 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    }
    setSubmitting(false);
  };

  const handleEmailLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword.trim(),
      });
      if (error) throw error;
      await refreshProfile();
      onClose();
    } catch (err: any) {
      toast({
        title: lang === 'en' ? 'Error' : 'Ошибка',
        description: err.message,
        variant: 'destructive',
      });
    }
    setSubmitting(false);
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) return;
    setSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: name.trim(), phone: phone.trim() },
        },
      });
      if (authError) throw authError;

      if (authData.user) {
        // Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
          user_id: authData.user.id,
          full_name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        });
        if (profileError) console.error('Profile creation error:', profileError);

        // Notify trainer via Telegram
        await supabase.functions.invoke('send-telegram', {
          body: {
            message: `🆕 <b>New Client Registered!</b>\n\n👤 ${name.trim()}\n📧 ${email.trim()}\n📱 ${phone.trim()}`,
          },
        });

        await refreshProfile();
      }

      toast({
        title: lang === 'en' ? 'Registration successful!' : 'Регистрация успешна!',
        description: lang === 'en'
          ? 'Please check your email to verify your account.'
          : 'Проверьте почту для подтверждения аккаунта.',
      });
      setStep('telegram');
    } catch (err: any) {
      toast({
        title: lang === 'en' ? 'Error' : 'Ошибка',
        description: err.message,
        variant: 'destructive',
      });
    }
    setSubmitting(false);
  };

  if (!open) return null;

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
          className="bg-card border border-border/50 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="relative p-6 pb-4 text-center">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-3">
              <span className="text-primary-foreground font-extrabold text-sm">LF</span>
            </div>
             <h3 className="text-lg font-extrabold font-heading uppercase tracking-tight">
              {step === 'welcome'
                ? lang === 'en' ? 'Welcome!' : 'Добро пожаловать!'
                : step === 'register'
                  ? lang === 'en' ? 'New Client' : 'Новый клиент'
                  : step === 'telegram'
                    ? lang === 'en' ? 'Stay Connected' : 'Будьте на связи'
                    : lang === 'en' ? 'Welcome Back' : 'С возвращением'}
            </h3>
            {step === 'welcome' && (
              <p className="text-xs text-muted-foreground mt-1">
                {lang === 'en'
                  ? 'Personal fitness training in Limassol'
                  : 'Персональные фитнес-тренировки в Лимассоле'}
              </p>
            )}
          </div>

          <div className="px-6 pb-6">
            <AnimatePresence mode="wait">
              {/* Step: Welcome */}
              {step === 'welcome' && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-3"
                >
                  <button
                    onClick={() => setStep('register')}
                    className="w-full bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-center gap-3 hover:bg-primary/20 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                      <UserPlus className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{lang === 'en' ? "I'm a new client" : 'Я новый клиент'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {lang === 'en' ? 'Create your account' : 'Создать аккаунт'}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setStep('login')}
                    className="w-full bg-secondary/50 border border-border/50 rounded-2xl p-4 flex items-center gap-3 hover:bg-secondary transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <LogIn className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{lang === 'en' ? "I'm already a client" : 'Я уже клиент'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {lang === 'en' ? 'Sign in to your account' : 'Войти в аккаунт'}
                      </p>
                    </div>
                  </button>
                </motion.div>
              )}

              {/* Step: Register */}
              {step === 'register' && (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    placeholder={lang === 'en' ? 'Full name' : 'Полное имя'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    maxLength={100}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    maxLength={255}
                  />
                  <input
                    type="tel"
                    placeholder={lang === 'en' ? 'Phone number' : 'Номер телефона'}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    maxLength={20}
                  />
                  <input
                    type="password"
                    placeholder={lang === 'en' ? 'Create password' : 'Придумайте пароль'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    maxLength={72}
                  />
                  <button
                    onClick={handleRegister}
                    disabled={submitting || !name.trim() || !email.trim() || !phone.trim() || !password.trim()}
                    className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>{lang === 'en' ? 'Sign Up' : 'Зарегистрироваться'}</>
                    )}
                  </button>

                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[10px] text-muted-foreground uppercase">{lang === 'en' ? 'or' : 'или'}</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>

                  <button
                    onClick={handleGoogleSignIn}
                    disabled={submitting}
                    className="w-full bg-white text-gray-800 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-all"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {lang === 'en' ? 'Continue with Google' : 'Войти через Google'}
                  </button>

                  <button
                    onClick={() => setStep('welcome')}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    ← {lang === 'en' ? 'Back' : 'Назад'}
                  </button>
                </motion.div>
              )}

              {/* Step: Login */}
              {step === 'login' && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3"
                >
                  <input
                    type="email"
                    placeholder="Email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    maxLength={255}
                  />
                  <input
                    type="password"
                    placeholder={lang === 'en' ? 'Password' : 'Пароль'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    maxLength={72}
                  />
                  <button
                    onClick={handleEmailLogin}
                    disabled={submitting || !loginEmail.trim() || !loginPassword.trim()}
                    className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>{lang === 'en' ? 'Sign In' : 'Войти'}</>
                    )}
                  </button>

                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[10px] text-muted-foreground uppercase">{lang === 'en' ? 'or' : 'или'}</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>

                  <button
                    onClick={handleGoogleSignIn}
                    disabled={submitting}
                    className="w-full bg-white text-gray-800 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-all"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {lang === 'en' ? 'Continue with Google' : 'Войти через Google'}
                  </button>

                  <button
                    onClick={() => setStep('welcome')}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    ← {lang === 'en' ? 'Back' : 'Назад'}
                  </button>
                </motion.div>
              )}

              {/* Step: Telegram */}
              {step === 'telegram' && (
                <motion.div
                  key="telegram"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
                    <Bot className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {lang === 'en'
                      ? 'Join our Telegram bot to receive training reminders and session updates!'
                      : 'Подключите Telegram-бот, чтобы получать напоминания о тренировках и обновления!'}
                  </p>
                  <a
                    href="https://t.me/LimassolFitness_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    <Bot className="w-4 h-4" />
                    {lang === 'en' ? 'Open Telegram Bot' : 'Открыть Telegram-бот'}
                  </a>
                  <button
                    onClick={onClose}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    {lang === 'en' ? 'Skip for now' : 'Пропустить'}
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
