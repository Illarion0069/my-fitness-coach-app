import React, { useState } from 'react';
import { CalendarPlus, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const FEED_HOST = `${import.meta.env.VITE_SUPABASE_URL}`.replace(/^https?:\/\//, '');

/** Gets (or creates) the trainer's private feed token and returns the subscription URL. */
async function getFeedUrl(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  let { data } = await supabase.from('calendar_feed_tokens').select('token').eq('trainer_user_id', user.id).maybeSingle();
  if (!data) {
    const res = await supabase.from('calendar_feed_tokens').insert({ trainer_user_id: user.id }).select('token').single();
    if (res.error) { console.error('Feed token create failed', res.error); return null; }
    data = res.data;
  }
  return `${FEED_HOST}/functions/v1/calendar-feed?token=${data.token}`;
}

export default function IphoneCalendarSubscribe({ lang }: { lang: 'en' | 'ru' | string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const en = lang === 'en';

  const subscribe = async () => {
    const url = await getFeedUrl();
    if (!url) return toast({ title: en ? 'Could not create link' : 'Не удалось создать ссылку', variant: 'destructive' });
    window.location.href = `webcal://${url}`;
  };

  const copy = async () => {
    const url = await getFeedUrl();
    if (!url) return;
    await navigator.clipboard.writeText(`https://${url}`);
    setCopied(true);
    toast({ title: en ? 'Link copied' : 'Ссылка скопирована' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="flex-1" onClick={subscribe}>
        <CalendarPlus className="mr-2 h-4 w-4" />
        {en ? 'Add to iPhone calendar' : 'Добавить в календарь iPhone'}
      </Button>
      <Button variant="outline" size="sm" onClick={copy} aria-label={en ? 'Copy link' : 'Копировать ссылку'}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
