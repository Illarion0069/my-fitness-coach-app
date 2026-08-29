// Canonical business facts as published on the site (index.html JSON-LD + pricing).
// Used to keep the Google Business Profile in sync with the website.

export const SITE_BUSINESS_INFO = {
  name: 'Limassol Fitness — Illarion Ientin',
  shortName: 'Limassol Fitness',
  phone: '+357 96 476746',
  website: 'https://limassol-fitness.com/',
  address: 'Eleftherias 119, Limassol, Cyprus',
  hours: 'Mon–Fri 07:00–20:00',
  priceRange: '€€',
  primaryCategory: 'Personal trainer',
  secondaryCategories: ['Gym', 'Physical fitness program', 'Fitness center'],
  mapsUrl: 'https://maps.app.goo.gl/BfsgGGsJaB5QCvsD9',
  instagram: 'https://www.instagram.com/illarion_ientin',
  services: [
    { name: 'Consultation (1h)', price: '50€' },
    { name: 'Single personal training session', price: '100€' },
    { name: '8 sessions package (1 month)', price: '750€' },
    { name: 'Gym membership', price: '150€/month' },
    { name: 'HIIT training', price: '' },
    { name: 'TRX training', price: '' },
    { name: 'Strength training', price: '' },
    { name: 'Stretching', price: '' },
    { name: 'Functional training', price: '' },
  ],
  description:
    'Personal trainer and private gym in Limassol, Cyprus. HIIT, TRX, strength & stretching with certified coach Illarion Ientin (EQF 3 & 4). Book online.',
} as const;

export type GbpFieldKey =
  | 'businessName'
  | 'primaryCategory'
  | 'secondaryCategories'
  | 'description'
  | 'services'
  | 'hours'
  | 'phone'
  | 'website'
  | 'address'
  | 'reviewLink'
  | 'reviewRequestEn'
  | 'reviewRequestRu';

export const GBP_FIELD_DEFAULTS: Record<GbpFieldKey, string> = {
  businessName: SITE_BUSINESS_INFO.name,
  primaryCategory: SITE_BUSINESS_INFO.primaryCategory,
  secondaryCategories: SITE_BUSINESS_INFO.secondaryCategories.join(', '),
  description: SITE_BUSINESS_INFO.description,
  services: SITE_BUSINESS_INFO.services
    .map((s) => (s.price ? `${s.name} — ${s.price}` : s.name))
    .join('\n'),
  hours: SITE_BUSINESS_INFO.hours,
  phone: SITE_BUSINESS_INFO.phone,
  website: SITE_BUSINESS_INFO.website,
  address: SITE_BUSINESS_INFO.address,
  reviewLink: '',
  reviewRequestEn:
    'Hi {name}! Great work today 💪 If you are happy with our training, could you leave a short Google review? It takes 30 seconds and really helps other people in Limassol find us: {link}',
  reviewRequestRu:
    'Привет, {name}! Отличная работа сегодня 💪 Если тебе нравятся наши тренировки, оставь, пожалуйста, короткий отзыв в Google — это 30 секунд, а нам очень помогает: {link}',
};

export interface GbpChecklistItem {
  id: string;
  group: 'profile' | 'content' | 'photos' | 'reviews';
  en: string;
  ru: string;
  hintEn?: string;
  hintRu?: string;
}

export const GBP_CHECKLIST: GbpChecklistItem[] = [
  { id: 'claimed', group: 'profile', en: 'Business claimed & verified in Google Business Profile', ru: 'Профиль подтверждён (верификация) в Google Business Profile' },
  { id: 'name_match', group: 'profile', en: 'Business name matches the site exactly', ru: 'Название совпадает с сайтом' },
  { id: 'category', group: 'profile', en: 'Primary category = Personal trainer', ru: 'Основная категория — Personal trainer' },
  { id: 'secondary', group: 'profile', en: 'Secondary categories added (Gym, Fitness center)', ru: 'Добавлены доп. категории (Gym, Fitness center)' },
  { id: 'address', group: 'profile', en: 'Address & map pin match Eleftherias 119', ru: 'Адрес и метка на карте — Eleftherias 119' },
  { id: 'hours', group: 'profile', en: 'Opening hours match the site (Mon–Fri 07:00–20:00)', ru: 'Часы работы совпадают с сайтом (Пн–Пт 07:00–20:00)' },
  { id: 'phone_site', group: 'profile', en: 'Phone & website link point to limassol-fitness.com', ru: 'Телефон и сайт ведут на limassol-fitness.com' },
  { id: 'booking_link', group: 'profile', en: 'Booking / appointment link added', ru: 'Добавлена ссылка на онлайн-запись' },

  { id: 'description', group: 'content', en: 'Description filled (750 chars, keywords: personal trainer Limassol)', ru: 'Заполнено описание (750 симв., ключевые слова: personal trainer Limassol)' },
  { id: 'services_list', group: 'content', en: 'All services added with prices matching the pricing page', ru: 'Все услуги с ценами как на странице цен' },
  { id: 'attributes', group: 'content', en: 'Attributes set (by appointment, wheelchair access, languages)', ru: 'Заполнены атрибуты (по записи, доступность, языки)' },
  { id: 'post_monthly', group: 'content', en: 'Post an update at least twice per month', ru: 'Публиковать обновление минимум 2 раза в месяц' },
  { id: 'qa', group: 'content', en: 'Q&A seeded with 3–5 common questions', ru: 'Добавлено 3–5 типовых вопросов в Q&A' },

  { id: 'logo_cover', group: 'photos', en: 'Logo & cover photo uploaded', ru: 'Загружены логотип и обложка' },
  { id: 'gym_photos', group: 'photos', en: 'At least 10 real gym / training photos', ru: 'Минимум 10 реальных фото зала и тренировок' },
  { id: 'team_photo', group: 'photos', en: 'Trainer photo matches the site hero photo', ru: 'Фото тренера совпадает с фото на сайте' },
  { id: 'photos_monthly', group: 'photos', en: 'Add fresh photos every month', ru: 'Добавлять свежие фото каждый месяц' },
  { id: 'video', group: 'photos', en: 'At least one short training video', ru: 'Минимум одно короткое видео тренировки' },

  { id: 'review_link', group: 'reviews', en: 'Short review link generated and saved below', ru: 'Создана и сохранена короткая ссылка на отзыв' },
  { id: 'ask_after_session', group: 'reviews', en: 'Ask happy clients for a review after a milestone session', ru: 'Просить отзыв у довольных клиентов после важной тренировки' },
  { id: 'reply_all', group: 'reviews', en: 'Reply to every review within 48 hours', ru: 'Отвечать на каждый отзыв в течение 48 часов' },
  { id: 'review_site', group: 'reviews', en: 'Google reviews shown on the site About section', ru: 'Отзывы Google показаны в разделе About на сайте' },
  { id: 'no_incentive', group: 'reviews', en: 'Never offer discounts for reviews (Google policy)', ru: 'Не предлагать скидки за отзывы (политика Google)' },
];
