import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, RotateCcw, Save, AlertTriangle, ExternalLink, Star, Image as ImageIcon, ListChecks, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  GBP_CHECKLIST,
  GBP_FIELD_DEFAULTS,
  SITE_BUSINESS_INFO,
  type GbpFieldKey,
} from '@/lib/siteBusinessInfo';

type Lang = 'en' | 'ru';

interface Props {
  lang: Lang;
}

const GROUPS: { id: 'profile' | 'content' | 'photos' | 'reviews'; en: string; ru: string; icon: typeof ListChecks }[] = [
  { id: 'profile', en: 'Profile basics', ru: 'Основное', icon: ListChecks },
  { id: 'content', en: 'Content & services', ru: 'Контент и услуги', icon: FileText },
  { id: 'photos', en: 'Photos & video', ru: 'Фото и видео', icon: ImageIcon },
  { id: 'reviews', en: 'Reviews engine', ru: 'Отзывы', icon: Star },
];

const FIELD_LABELS: Record<GbpFieldKey, { en: string; ru: string; multiline?: boolean; syncable?: boolean }> = {
  businessName: { en: 'Business name', ru: 'Название', syncable: true },
  primaryCategory: { en: 'Primary category', ru: 'Основная категория', syncable: true },
  secondaryCategories: { en: 'Secondary categories', ru: 'Доп. категории', syncable: true },
  description: { en: 'Description', ru: 'Описание', multiline: true, syncable: true },
  services: { en: 'Services & prices', ru: 'Услуги и цены', multiline: true, syncable: true },
  hours: { en: 'Opening hours', ru: 'Часы работы', syncable: true },
  phone: { en: 'Phone', ru: 'Телефон', syncable: true },
  website: { en: 'Website', ru: 'Сайт', syncable: true },
  address: { en: 'Address', ru: 'Адрес', syncable: true },
  reviewLink: { en: 'Google review short link', ru: 'Короткая ссылка на отзыв' },
  reviewRequestEn: { en: 'Review request template (EN)', ru: 'Шаблон запроса отзыва (EN)', multiline: true },
  reviewRequestRu: { en: 'Review request template (RU)', ru: 'Шаблон запроса отзыва (RU)', multiline: true },
};

const PROFILE_FIELDS: GbpFieldKey[] = ['businessName', 'primaryCategory', 'secondaryCategories', 'phone', 'website', 'address', 'hours'];
const CONTENT_FIELDS: GbpFieldKey[] = ['description', 'services'];
const REVIEW_FIELDS: GbpFieldKey[] = ['reviewLink', 'reviewRequestEn', 'reviewRequestRu'];

const GbpIntegrationView = ({ lang }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fields, setFields] = useState<Record<string, string>>({ ...GBP_FIELD_DEFAULTS });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('gbp_settings')
        .select('fields, checklist')
        .eq('trainer_user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setFields({ ...GBP_FIELD_DEFAULTS, ...((data.fields as Record<string, string>) || {}) });
        setChecklist(((data.checklist as Record<string, boolean>) || {}));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const save = useCallback(async (nextFields: Record<string, string>, nextChecklist: Record<string, boolean>) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('gbp_settings')
      .upsert({ trainer_user_id: user.id, fields: nextFields, checklist: nextChecklist }, { onConflict: 'trainer_user_id' });
    setSaving(false);
    if (error) {
      toast({ title: lang === 'en' ? 'Save failed' : 'Ошибка сохранения', description: error.message, variant: 'destructive' });
      return;
    }
    setDirty(false);
    toast({ title: lang === 'en' ? 'Saved' : 'Сохранено', duration: 1500 });
  }, [user, lang, toast]);

  const toggleItem = (id: string) => {
    const next = { ...checklist, [id]: !checklist[id] };
    setChecklist(next);
    void save(fields, next);
  };

  const setField = (key: GbpFieldKey, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: lang === 'en' ? 'Copied' : 'Скопировано', duration: 1200 });
    } catch {
      toast({ title: lang === 'en' ? 'Copy failed' : 'Не удалось скопировать', variant: 'destructive' });
    }
  };

  const done = useMemo(() => GBP_CHECKLIST.filter((i) => checklist[i.id]).length, [checklist]);
  const progress = Math.round((done / GBP_CHECKLIST.length) * 100);

  const renderField = (key: GbpFieldKey) => {
    const meta = FIELD_LABELS[key];
    const value = fields[key] ?? '';
    const siteValue = GBP_FIELD_DEFAULTS[key];
    const mismatch = !!meta.syncable && value.trim() !== siteValue.trim();
    return (
      <div key={key} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{meta[lang]}</label>
          {mismatch && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500">
              <AlertTriangle className="w-3 h-3" />
              {lang === 'en' ? 'differs from site' : 'отличается от сайта'}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {meta.syncable && mismatch && (
              <button
                onClick={() => setField(key, siteValue)}
                title={lang === 'en' ? 'Reset to site value' : 'Вернуть значение с сайта'}
                className="w-7 h-7 rounded-lg bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => copy(value)}
              title={lang === 'en' ? 'Copy' : 'Копировать'}
              className="w-7 h-7 rounded-lg bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {meta.multiline ? (
          <textarea
            value={value}
            rows={key === 'description' ? 4 : 5}
            onChange={(e) => setField(key, e.target.value)}
            className="w-full bg-secondary/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60 resize-y"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => setField(key, e.target.value)}
            className="w-full bg-secondary/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60"
          />
        )}
        {key === 'description' && (
          <p className="text-[10px] text-muted-foreground">{value.length}/750</p>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{lang === 'en' ? 'Loading…' : 'Загрузка…'}</div>;
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Progress */}
      <div className="bg-card border border-border/50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold">{lang === 'en' ? 'Google Business Profile readiness' : 'Готовность Google-профиля'}</p>
          <span className="text-sm font-extrabold text-primary">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <motion.div className="h-full gradient-primary" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {done}/{GBP_CHECKLIST.length} {lang === 'en' ? 'steps done' : 'шагов выполнено'}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <a
            href="https://business.google.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg gradient-primary text-primary-foreground"
          >
            <ExternalLink className="w-3 h-3" /> {lang === 'en' ? 'Open GBP' : 'Открыть GBP'}
          </a>
          <a
            href={SITE_BUSINESS_INFO.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-secondary/60"
          >
            <ExternalLink className="w-3 h-3" /> {lang === 'en' ? 'View on Maps' : 'Смотреть на картах'}
          </a>
        </div>
      </div>

      {/* Checklist */}
      {GROUPS.map((group) => {
        const items = GBP_CHECKLIST.filter((i) => i.group === group.id);
        const groupDone = items.filter((i) => checklist[i.id]).length;
        const Icon = group.icon;
        return (
          <div key={group.id} className="bg-card border border-border/50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold">{group[lang]}</p>
              <span className="ml-auto text-[11px] text-muted-foreground">{groupDone}/{items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.map((item) => {
                const checked = !!checklist[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className="w-full flex items-start gap-2.5 text-left py-1.5 group"
                  >
                    <span
                      className={`mt-0.5 w-[18px] h-[18px] shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                        checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border group-hover:border-primary/60'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    <span className={`text-xs leading-snug ${checked ? 'text-muted-foreground line-through' : ''}`}>
                      {item[lang]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Content fields */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-bold">{lang === 'en' ? 'Profile fields (copy into Google)' : 'Поля профиля (копировать в Google)'}</p>
        {PROFILE_FIELDS.map(renderField)}
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-bold">{lang === 'en' ? 'Description & services' : 'Описание и услуги'}</p>
        {CONTENT_FIELDS.map(renderField)}
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-bold">{lang === 'en' ? 'Review engine' : 'Сбор отзывов'}</p>
        <p className="text-[11px] text-muted-foreground">
          {lang === 'en'
            ? 'Placeholders {name} and {link} are replaced when you send the message.'
            : 'Плейсхолдеры {name} и {link} подставляются при отправке сообщения.'}
        </p>
        {REVIEW_FIELDS.map(renderField)}
        <button
          onClick={() => {
            const link = fields.reviewLink || SITE_BUSINESS_INFO.mapsUrl;
            const tpl = lang === 'en' ? fields.reviewRequestEn : fields.reviewRequestRu;
            copy(tpl.replace('{link}', link));
          }}
          className="w-full text-xs font-bold py-2.5 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
        >
          {lang === 'en' ? 'Copy ready review request' : 'Скопировать готовый запрос отзыва'}
        </button>
      </div>

      <button
        onClick={() => save(fields, checklist)}
        disabled={saving || !dirty}
        className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl gradient-primary text-primary-foreground disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? (lang === 'en' ? 'Saving…' : 'Сохраняю…') : (lang === 'en' ? 'Save fields' : 'Сохранить поля')}
      </button>
    </div>
  );
};

export default GbpIntegrationView;
