export type Language = 'en' | 'ru';

export const translations = {
  nav: {
    home: { en: 'Home', ru: 'Главная' },
    test: { en: 'Test', ru: 'Тест' },
    pricing: { en: 'Pricing', ru: 'Цены' },
    group: { en: 'Group', ru: 'Группа' },
    reviews: { en: 'Reviews', ru: 'Отзывы' },
    contact: { en: 'Contact', ru: 'Контакты' },
  },
  hero: {
    title: {
      line1: { en: 'PERSONAL', ru: 'ПЕРСОНАЛЬНЫЙ' },
      line2: { en: 'FITNESS', ru: 'ФИТНЕС' },
      line3: { en: 'ASSISTANT', ru: 'АССИСТЕНТ' },
    },
    subtitle: {
      en: 'Personal training that fits your life — not the other way around',
      ru: 'Персональные тренировки, которые подстраиваются под вашу жизнь, а не наоборот',
    },
    cta: { en: 'Book your session', ru: 'Забронировать тренировку' },
    trainer: { en: 'Illarion Ientin', ru: 'Илларион Иентин' },
    tagline: {
      en: 'Your Elite Personal Trainer in Limassol',
      ru: 'Ваш элитный персональный тренер в Лимассоле',
    },
    usps: [
      {
        icon: '🎯',
        title: { en: 'Technique First', ru: 'Техника — прежде всего' },
        desc: { en: 'Every rep matters. I control your form so you get results, not injuries.', ru: 'Каждое повторение важно. Я контролирую вашу технику — результат без травм.' },
      },
      {
        icon: '🏠',
        title: { en: 'Home & On-Location', ru: 'Выезд к вам' },
        desc: { en: 'Training at the best gym in Limassol or at your villa — wherever suits you.', ru: 'Тренировки в лучшем зале Лимассола или на вашей вилле — как вам удобно.' },
      },
      {
        icon: '✈️',
        title: { en: 'Even on Your Trips', ru: 'Даже в командировке' },
        desc: { en: 'Travelling? I stay with you online — programs, check-ins, adjustments.', ru: 'В поездке? Я на связи онлайн — программы, контроль, корректировки.' },
      },
      {
        icon: '👑',
        title: { en: 'Elite Clientele', ru: 'Элитная клиентура' },
        desc: { en: 'I work with the most demanding clients in Limassol who expect nothing but the best.', ru: 'Я работаю с самыми требовательными клиентами Лимассола, которые принимают только лучшее.' },
      },
    ],
  },
  workouts: {
    title: { en: 'WORKOUTS', ru: 'ТРЕНИРОВКИ' },
    items: [
      {
        name: { en: 'Weight Loss', ru: 'Похудение' },
        desc: {
          en: 'High-intensity interval training (HIIT) combined with mid-intensity cardio. Maximum calorie burn, accelerated metabolism and visible results in the shortest time.',
          ru: 'Высокоинтенсивные интервальные тренировки (HIIT) в сочетании с кардио средней интенсивности. Максимальное сжигание калорий, ускорение метаболизма и видимый результат в кратчайшие сроки.',
        },
        icon: '🔥',
      },
      {
        name: { en: 'Muscle Gain', ru: 'Набор мышц' },
        desc: {
          en: 'Strength and functional training using free weights, TRX suspension system and Procedos 3D platform. Building lean muscle mass, improving posture and joint mobility.',
          ru: 'Силовые и функциональные тренировки с использованием свободных весов, подвесной системы TRX и платформы Procedos 3D. Набор сухой мышечной массы, улучшение осанки и подвижности суставов.',
        },
        icon: '💪',
      },
      {
        name: { en: 'Flexibility', ru: 'Растяжка' },
        desc: {
          en: 'Animal Flow movement practice and myofascial release (MFR) with foam rollers. Develops flexibility, relieves muscle tension, improves posture and accelerates recovery.',
          ru: 'Практика движений Animal Flow и миофасциальный релиз (MFR) с роллерами. Развивает гибкость, снимает мышечное напряжение, улучшает осанку и ускоряет восстановление.',
        },
        icon: '🧘',
      },
      {
        name: { en: 'Stay in Shape', ru: 'В форме' },
        desc: {
          en: 'Balanced program to maintain your current fitness level. A mix of strength, cardio and mobility work tailored to keep you toned, energized and injury-free.',
          ru: 'Сбалансированная программа для поддержания текущей физической формы. Сочетание силовых, кардио и мобильных упражнений для тонуса, энергии и профилактики травм.',
        },
        icon: '⚡',
      },
      {
        name: { en: 'Pain Relief', ru: 'Боль в теле' },
        desc: {
          en: 'Careful, detail-oriented exercises focused on spinal decompression and targeted muscle work. Every movement is controlled and precise — relieving back pain, improving posture and restoring comfort.',
          ru: 'Внимательные, детальные упражнения, направленные на декомпрессию позвоночника и точечную проработку мышц. Каждое движение контролируемое и точное — снятие боли в спине, улучшение осанки и восстановление комфорта.',
        },
        icon: '🩺',
      },
    ],
  },
  pricing: {
    title: { en: 'PRICING', ru: 'ЦЕНЫ' },
    gymNote: {
      en: 'Gym membership 150€/month is paid separately',
      ru: 'Абонемент зала 150€/мес оплачивается отдельно',
    },
    buy: { en: 'Buy Now', ru: 'Купить' },
    packages: [
      {
        id: 'consultation',
        sessions: 1,
        period: { en: '', ru: '' },
        price: 50,
        popular: false,
        isConsultation: true,
        label: { en: 'Consultation (1h)', ru: 'Консультация (1 час)' },
        features: {
          en: ['Fitness assessment', 'Goal setting', 'Program recommendation'],
          ru: ['Оценка физической формы', 'Постановка целей', 'Рекомендация программы'],
        },
      },
      {
        id: 'single',
        sessions: 1,
        period: { en: '', ru: '' },
        price: 100,
        popular: false,
        label: { en: 'Single Session', ru: 'Разовая тренировка' },
        features: {
          en: ['Personal assistance', 'Water & Towel'],
          ru: ['Персональный ассистент', 'Вода и полотенце'],
        },
      },
      {
        id: 'pack8',
        sessions: 8,
        period: { en: '1 month', ru: '1 месяц' },
        price: 750,
        popular: false,
        features: {
          en: ['Personal assistance', 'Water & Towel'],
          ru: ['Персональный ассистент', 'Вода и полотенце'],
        },
      },
      {
        id: 'pack12',
        sessions: 12,
        period: { en: '1 month', ru: '1 месяц' },
        price: 1030,
        popular: true,
        features: {
          en: ['Personal assistance', 'Water & Towel'],
          ru: ['Персональный ассистент', 'Вода и полотенце'],
        },
      },
      {
        id: 'pack20',
        sessions: 20,
        period: { en: '2 months', ru: '2 месяца' },
        price: 1599,
        popular: false,
        features: {
          en: ['Personal assistance', 'Water & Towel', 'Vacation support'],
          ru: ['Персональный ассистент', 'Вода и полотенце', 'Поддержка на каникулах'],
        },
      },
    ],
  },
  about: {
    title: { en: 'ABOUT ME', ru: 'ОБО МНЕ' },
    name: { en: 'Illarion Ientin', ru: 'Илларион Иентин' },
    bio: {
      en: 'Professional fitness trainer with European accreditation EQF Level 3 and EQF Level 4. I provide high-quality, personalized fitness services designed to help you achieve your goals efficiently and safely. My approach combines modern training methods with individual attention to each client.',
      ru: 'Профессиональный фитнес-тренер с европейской аккредитацией EQF уровня 3 и EQF уровня 4. Я предоставляю высококачественные персонализированные фитнес-услуги, разработанные для эффективного и безопасного достижения ваших целей. Мой подход сочетает современные методы тренировок с индивидуальным вниманием к каждому клиенту.',
    },
    certifications: {
      en: 'Certifications',
      ru: 'Сертификаты',
    },
    certs: ['EQF 3', 'EQF 4', 'HIIT', 'TRX', 'Procedos', 'Recovery MFR', 'Animal Flow', 'Strength Training'],
    accreditation: {
      en: 'European Accreditation EQF 3 & EQF 4',
      ru: 'Европейская аккредитация EQF 3 и EQF 4',
    },
  },
  transformations: {
    title: { en: 'TRANSFORMATIONS', ru: 'ТРАНСФОРМАЦИИ' },
    subtitle: { en: 'Real results from real people', ru: 'Реальные результаты реальных людей' },
    items: [
      {
        name: { en: 'Natalia K.', ru: 'Наталья К.' },
        result: { en: '-12 kg in 3 months', ru: '-12 кг за 3 месяца' },
        desc: {
          en: 'Housewife, 43 years old. Completely transformed her lifestyle. From no exercise to 3x/week training routine.',
          ru: 'Домохозяйка, 43 года. Полностью изменила образ жизни. С нуля до 3 тренировок в неделю.',
        },
        duration: { en: '3 months', ru: '3 месяца' },
        metric: '-12 kg',
      },
      {
        name: { en: 'Pavel K.', ru: 'Павел К.' },
        result: { en: '-8 kg, +4 kg muscle in 4 months', ru: '-8 кг, +4 кг мышц за 4 месяца' },
        desc: {
          en: 'Busy CEO working 12h/day. Proved that you can transform even with the tightest schedule.',
          ru: 'Занятой CEO, работает по 12ч/день. Доказал, что трансформация возможна при любом графике.',
        },
        duration: { en: '4 months', ru: '4 месяца' },
        metric: '-8 kg',
      },
      {
        name: { en: 'Veronika O.', ru: 'Вероника О.' },
        result: { en: '-6 kg, waist -8 cm in 2 months', ru: '-6 кг, талия -8 см за 2 месяца' },
        desc: {
          en: 'Office worker, 32. Found perfect balance between desk work and active lifestyle.',
          ru: 'Офисный работник, 32 года. Нашла баланс между сидячей работой и активным образом жизни.',
        },
        duration: { en: '2 months', ru: '2 месяца' },
        metric: '-8 cm',
      },
    ],
  },
  reviews: {
    title: { en: 'REVIEWS', ru: 'ОТЗЫВЫ' },
    subtitle: { en: 'We are proud of you', ru: 'Мы гордимся вами' },
    items: [
      {
        name: { en: 'Natalia Kakurina', ru: 'Наталья Какурина' },
        desc: {
          en: 'Housewife, mother of a teenager, 43 years old. Completely transformed her lifestyle and achieved amazing results in just 3 months.',
          ru: 'Домохозяйка, мать подростка, 43 года. Полностью изменила образ жизни и достигла потрясающих результатов всего за 3 месяца.',
        },
        rating: 5,
      },
      {
        name: { en: 'Pavel Kostyuchenko', ru: 'Павел Костюченко' },
        desc: {
          en: 'Proved that you can get fit even with the busiest work schedule. Working from morning to night didn\'t stop him from achieving his goals.',
          ru: 'Доказал, что можно привести себя в форму даже при самом загруженном графике работы. Работа с утра до ночи не помешала ему достичь целей.',
        },
        rating: 5,
      },
      {
        name: { en: 'Veronika Olshanskaya', ru: 'Вероника Ольшанская' },
        desc: {
          en: '32 years old, office worker. Found the perfect balance between desk work and active lifestyle with personalized training program.',
          ru: '32 года, офисный работник. Нашла идеальный баланс между сидячей работой и активным образом жизни с персонализированной программой тренировок.',
        },
        rating: 5,
      },
    ],
  },
  contact: {
    title: { en: 'CONTACT', ru: 'КОНТАКТЫ' },
    phone: '+357 95 144 819',
    address: { en: 'Eleftherias 119, Limassol', ru: 'Элефтериас 119, Лимассол' },
  },
  test: {
    title: { en: 'HEALTH ASSESSMENT', ru: 'ОЦЕНКА ЗДОРОВЬЯ' },
    subtitle: {
      en: 'Take a quick test to evaluate your nutrition habits and health',
      ru: 'Пройдите быстрый тест для оценки привычек питания и здоровья',
    },
    start: { en: 'Start Test', ru: 'Начать тест' },
    saveResults: { en: 'Create account to save your results and track progress', ru: 'Создайте аккаунт, чтобы сохранить результаты и отслеживать прогресс' },
    register: { en: 'Save & Register', ru: 'Сохранить и зарегистрироваться' },
    continueWithout: { en: 'Continue without saving', ru: 'Продолжить без сохранения' },
    next: { en: 'Next', ru: 'Далее' },
    back: { en: 'Back', ru: 'Назад' },
    submit: { en: 'Get Results', ru: 'Получить результаты' },
    nameLabel: { en: 'Full Name', ru: 'Имя и фамилия' },
    phoneLabel: { en: 'Phone Number', ru: 'Номер телефона' },
    resultTitle: { en: 'Your Health Score', ru: 'Ваша оценка здоровья' },
    sendResults: { en: 'Results sent to trainer', ru: 'Результаты отправлены тренеру' },
    whoStandards: { en: 'Based on WHO standards', ru: 'На основе стандартов ВОЗ' },
    questions: [
      // Nutrition
      { q: { en: 'How many meals do you eat per day?', ru: 'Сколько приёмов пищи в день?' }, options: { en: ['1-2', '3', '4-5', '6+'], ru: ['1-2', '3', '4-5', '6+'] }, scores: [1, 3, 4, 3] },
      { q: { en: 'How often do you eat vegetables?', ru: 'Как часто вы едите овощи?' }, options: { en: ['Rarely', 'Few times/week', 'Daily', 'Every meal'], ru: ['Редко', 'Несколько раз/нед', 'Каждый день', 'Каждый приём'] }, scores: [1, 2, 3, 4] },
      { q: { en: 'How much water do you drink daily?', ru: 'Сколько воды вы пьёте в день?' }, options: { en: ['< 1L', '1-1.5L', '1.5-2.5L', '> 2.5L'], ru: ['< 1л', '1-1.5л', '1.5-2.5л', '> 2.5л'] }, scores: [1, 2, 4, 3] },
      { q: { en: 'Do you eat processed/fast food?', ru: 'Вы едите фастфуд/полуфабрикаты?' }, options: { en: ['Daily', 'Often', 'Sometimes', 'Rarely/Never'], ru: ['Каждый день', 'Часто', 'Иногда', 'Редко/Никогда'] }, scores: [1, 2, 3, 4] },
      { q: { en: 'How much sugar do you consume?', ru: 'Сколько сахара вы потребляете?' }, options: { en: ['A lot', 'Moderate', 'Little', 'Almost none'], ru: ['Много', 'Умеренно', 'Мало', 'Почти нет'] }, scores: [1, 2, 3, 4] },
      // Health & Lifestyle
      { q: { en: 'How many hours do you sleep?', ru: 'Сколько часов вы спите?' }, options: { en: ['< 5h', '5-6h', '7-8h', '> 8h'], ru: ['< 5ч', '5-6ч', '7-8ч', '> 8ч'] }, scores: [1, 2, 4, 3] },
      { q: { en: 'How often do you exercise?', ru: 'Как часто вы тренируетесь?' }, options: { en: ['Never', '1-2x/week', '3-4x/week', '5+/week'], ru: ['Никогда', '1-2 раза/нед', '3-4 раза/нед', '5+ раз/нед'] }, scores: [1, 2, 4, 3] },
      { q: { en: 'How would you rate your stress level?', ru: 'Как вы оцениваете уровень стресса?' }, options: { en: ['Very high', 'High', 'Moderate', 'Low'], ru: ['Очень высокий', 'Высокий', 'Умеренный', 'Низкий'] }, scores: [1, 2, 3, 4] },
      { q: { en: 'Do you smoke or drink alcohol?', ru: 'Вы курите или пьёте алкоголь?' }, options: { en: ['Both regularly', 'One of them', 'Occasionally', 'Neither'], ru: ['Оба регулярно', 'Что-то одно', 'Иногда', 'Ни то, ни другое'] }, scores: [1, 2, 3, 4] },
      { q: { en: 'How many steps do you walk daily?', ru: 'Сколько шагов в день вы проходите?' }, options: { en: ['< 3000', '3000-5000', '5000-10000', '> 10000'], ru: ['< 3000', '3000-5000', '5000-10000', '> 10000'] }, scores: [1, 2, 3, 4] },
    ],
  },
} as const;
