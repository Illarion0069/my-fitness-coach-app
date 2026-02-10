export type Language = 'en' | 'ru';

export const translations = {
  nav: {
    home: { en: 'Home', ru: 'Главная' },
    test: { en: 'Test', ru: 'Тест' },
    pricing: { en: 'Pricing', ru: 'Цены' },
    about: { en: 'About', ru: 'Обо мне' },
    contact: { en: 'Contact', ru: 'Контакты' },
  },
  hero: {
    title: { en: 'PERSONAL FITNESS ASSISTANT', ru: 'ПЕРСОНАЛЬНЫЙ ФИТНЕС-АССИСТЕНТ' },
    subtitle: {
      en: 'Provides high-quality fitness service in Limassol',
      ru: 'Высококачественные фитнес-услуги в Лимассоле',
    },
    cta: { en: 'Book your session', ru: 'Забронировать тренировку' },
    trainer: { en: 'Illarion Ientin', ru: 'Илларион Иентин' },
  },
  workouts: {
    title: { en: 'WORKOUTS', ru: 'ТРЕНИРОВКИ' },
    items: [
      {
        name: { en: 'HIIT', ru: 'ВИИТ' },
        desc: {
          en: 'High-Intensity Interval Training. Intervals of maximal effort with rest periods. Oriented towards maximum fat loss and muscle strength.',
          ru: 'Высокоинтенсивная интервальная тренировка. Интервалы максимального усилия с периодами отдыха. Направлена на максимальное сжигание жира и силу мышц.',
        },
        icon: '⚡',
      },
      {
        name: { en: 'TRX', ru: 'TRX' },
        desc: {
          en: 'Simple and effective training using only body weight. All muscle groups are engaged. Positive effect on muscle tone, posture and figure.',
          ru: 'Простая и эффективная тренировка с собственным весом. Задействованы все группы мышц. Положительное влияние на тонус, осанку и фигуру.',
        },
        icon: '🔗',
      },
      {
        name: { en: 'Stretching', ru: 'Растяжка' },
        desc: {
          en: 'Combines elements of yoga and martial arts. Simulated animal movements. Develops flexibility, muscle strength, improves posture and recovery.',
          ru: 'Сочетает элементы йоги и единоборств. Имитация движений животных. Развивает гибкость, силу мышц, улучшает осанку и восстановление.',
        },
        icon: '🧘',
      },
      {
        name: { en: 'Cardio', ru: 'Кардио' },
        desc: {
          en: 'Fat-burning, mid-intensity training engaging all muscle groups. Develops endurance, cardiovascular system and metabolism.',
          ru: 'Жиросжигающая тренировка средней интенсивности. Развивает выносливость, сердечно-сосудистую систему и метаболизм.',
        },
        icon: '❤️‍🔥',
      },
      {
        name: { en: 'Strength', ru: 'Силовая' },
        desc: {
          en: 'General training with weights. Develops muscle strength, improves joint mobility, posture, hormonal function and bone density.',
          ru: 'Общая тренировка с отягощениями. Развивает силу мышц, улучшает подвижность суставов, осанку и гормональную систему.',
        },
        icon: '💪',
      },
      {
        name: { en: '3D Procedos', ru: '3D Procedos' },
        desc: {
          en: 'Platform with 3D indicators. Exercises with dumbbells and body weight. Forms new neural connections. Improves balance and dynamic power.',
          ru: 'Платформа с 3D-индикаторами. Упражнения с гантелями и собственным весом. Формирует новые нейронные связи. Улучшает баланс и динамическую силу.',
        },
        icon: '🎯',
      },
      {
        name: { en: 'Foam Rolling', ru: 'Миофасциальный релиз' },
        desc: {
          en: 'Muscle recovery training. Self-massage with foam roller & massage ball. Relaxes muscles, removes clamps and restores circulation.',
          ru: 'Тренировка для восстановления мышц. Самомассаж с роллером и мячом. Расслабляет мышцы, снимает зажимы и восстанавливает кровообращение.',
        },
        icon: '🧊',
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
        sessions: 12,
        period: { en: '1 month', ru: '1 месяц' },
        price: 1030,
        popular: true,
        features: {
          en: ['Personal assistance', 'Water & Towel', 'Nutritionist visit'],
          ru: ['Персональный ассистент', 'Вода и полотенце', 'Визит нутрициолога'],
        },
      },
      {
        sessions: 20,
        period: { en: '2 months', ru: '2 месяца' },
        price: 1599,
        popular: false,
        features: {
          en: ['Personal assistance', 'Water & Towel', 'Nutritionist visit', 'Vacation support'],
          ru: ['Персональный ассистент', 'Вода и полотенце', 'Визит нутрициолога', 'Поддержка на каникулах'],
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
    certs: ['TRX', 'Procedos', 'Recovery MFR', 'Animal Flow', 'Strength Training'],
    accreditation: {
      en: 'European Accreditation EQF 3 & EQF 4',
      ru: 'Европейская аккредитация EQF 3 и EQF 4',
    },
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
