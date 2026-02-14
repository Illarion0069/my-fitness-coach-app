import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const WhoopCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const exchangeCode = async () => {
      const code = searchParams.get('code');
      if (!code) {
        setStatus('error');
        setErrorMsg('No authorization code received');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('error');
        setErrorMsg('Not authenticated');
        return;
      }

      const { data, error } = await supabase.functions.invoke('whoop-auth', {
        body: {
          action: 'exchange_code',
          code,
          redirect_uri: `${window.location.origin}/whoop-callback`,
        },
      });

      if (error || !data?.success) {
        setStatus('error');
        setErrorMsg(error?.message || 'Failed to connect Whoop');
        return;
      }

      setStatus('success');
      toast({
        title: lang === 'en' ? '✅ Whoop connected!' : '✅ Whoop подключён!',
        description: lang === 'en' ? 'Your fitness data will sync automatically.' : 'Ваши фитнес-данные будут синхронизироваться автоматически.',
      });
      setTimeout(() => navigate('/'), 2000);
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-lg text-foreground font-semibold">
              {lang === 'en' ? 'Connecting Whoop...' : 'Подключаем Whoop...'}
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg text-foreground font-semibold">
              {lang === 'en' ? 'Whoop connected!' : 'Whoop подключён!'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {lang === 'en' ? 'Redirecting...' : 'Перенаправляем...'}
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-lg text-foreground font-semibold">
              {lang === 'en' ? 'Connection failed' : 'Ошибка подключения'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">{errorMsg}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2 rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              {lang === 'en' ? 'Go back' : 'Назад'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default WhoopCallback;
