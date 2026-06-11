// Bilingual builders for schedule-related Telegram notifications.
// Each builder returns { en, ru } strings — the cron picks one based on the
// client's preferred_language.

export interface BiText {
  en: string;
  ru: string;
}

const fmtDate = (isoDate: string, locale: 'en' | 'ru') => {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(
    locale === 'en' ? 'en-US' : 'ru-RU',
    { day: 'numeric', month: 'long', weekday: 'short' }
  );
};

const cleanTime = (t?: string | null) => (t ? t.slice(0, 5) : '');

export function sessionAdded(opts: {
  mode: 'once' | 'recurring';
  date?: string; // ISO yyyy-mm-dd, required when mode === 'once'
  time?: string | null;
  recurDayEn?: string;
  recurDayRu?: string;
}): BiText {
  const time = cleanTime(opts.time);
  if (opts.mode === 'once' && opts.date) {
    const en = `✅ <b>Session added</b>\n📆 ${fmtDate(opts.date, 'en')}${time ? ` at ${time}` : ''}\n☝️ One-time`;
    const ru = `✅ <b>Тренировка добавлена</b>\n📆 ${fmtDate(opts.date, 'ru')}${time ? ` в ${time}` : ''}\n☝️ Разовая`;
    return { en, ru };
  }
  return {
    en: `✅ <b>Session added</b>\n📆 every ${opts.recurDayEn}${time ? ` at ${time}` : ''}\n🔄 Recurring`,
    ru: `✅ <b>Тренировка добавлена</b>\n📆 каждый ${opts.recurDayRu}${time ? ` в ${time}` : ''}\n🔄 Повторяющаяся`,
  };
}

export function sessionCancelled(opts: {
  date?: string;
  time?: string | null;
  recurDayEn?: string;
  recurDayRu?: string;
  recurring?: boolean;
  seriesEnded?: boolean;
}): BiText {
  if (opts.seriesEnded) {
    return {
      en: `❌ <b>Recurring series cancelled</b>`,
      ru: `❌ <b>Серия тренировок отменена</b>`,
    };
  }
  const time = cleanTime(opts.time);
  if (opts.recurring && opts.recurDayEn) {
    return {
      en: `❌ <b>Session cancelled</b>\n📅 every ${opts.recurDayEn}${time ? ` at ${time}` : ''}`,
      ru: `❌ <b>Тренировка отменена</b>\n📅 каждый ${opts.recurDayRu}${time ? ` в ${time}` : ''}`,
    };
  }
  if (!opts.date) return { en: '', ru: '' };
  return {
    en: `❌ <b>Session cancelled</b>\n📆 ${fmtDate(opts.date, 'en')}${time ? ` at ${time}` : ''}`,
    ru: `❌ <b>Тренировка отменена</b>\n📆 ${fmtDate(opts.date, 'ru')}${time ? ` в ${time}` : ''}`,
  };
}

export function sessionMoved(opts: {
  date: string;
  newTime: string;
  wholeSeries?: boolean;
  variant?: 'rescheduled' | 'time-changed';
}): BiText {
  const time = cleanTime(opts.newTime);
  const seriesEn = opts.wholeSeries ? `\n🔄 For the whole series` : '';
  const seriesRu = opts.wholeSeries ? `\n🔄 Для всей серии` : '';
  if (opts.variant === 'rescheduled') {
    return {
      en: `🔄 <b>Session rescheduled</b>\n📆 ${fmtDate(opts.date, 'en')}\n🕐 New time: ${time}`,
      ru: `🔄 <b>Тренировка перенесена</b>\n📆 ${fmtDate(opts.date, 'ru')}\n🕐 Новое время: ${time}`,
    };
  }
  return {
    en: `🔄 <b>Session time changed</b>\n📆 ${fmtDate(opts.date, 'en')}\n🕐 New time: ${time}${seriesEn}`,
    ru: `🔄 <b>Время тренировки изменено</b>\n📆 ${fmtDate(opts.date, 'ru')}\n🕐 Новое время: ${time}${seriesRu}`,
  };
}
