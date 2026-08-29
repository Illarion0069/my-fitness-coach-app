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
      line1: { en: 'PERSONAL TRAINER', ru: 'ПЕРСОНАЛЬНЫЙ' },
      line2: { en: '& GYM', ru: 'ТРЕНЕР И ЗАЛ' },
      line3: { en: 'IN LIMASSOL', ru: 'В ЛИМАССОЛЕ' },
    },
    subtitle: {
      en: 'Personal training that fits your life — not the other way around',
      ru: 'Персональные тренировки, которые подстраиваются под вашу жизнь, а не наоборот',
    },
    cta: { en: 'Book your session', ru: 'Забронировать тренировку' },
    trainer: { en: 'Illarion Ientin', ru: 'Илларион Ентин' },
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
    name: { en: 'Illarion Ientin', ru: 'Илларион Ентин' },
    bio: {
      en: 'Personal trainer in Limassol with 8+ years of hands-on coaching. I build precise, individual programs around your goals, schedule and body — blending strength work, mobility and recovery so progress actually sticks.',
      ru: 'Персональный тренер в Лимассоле, 8+ лет практики. Строю точные индивидуальные программы под ваши цели, график и тело — сочетаю силовую работу, мобилити и восстановление, чтобы прогресс действительно закреплялся.',
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
    subtitle: { en: 'Real reviews from Google Maps', ru: 'Реальные отзывы из Google Карт' },
    items: [
      {
        name: { en: 'Natalia K.', ru: 'Наталья К.' },
        desc: {
          en: 'Illarion is an incredible trainer! He pays attention to every detail of technique and truly cares about results. In 3 months I lost 12 kg and feel 10 years younger. Highly recommend to anyone serious about fitness!',
          ru: 'Илларион — невероятный тренер! Обращает внимание на каждую деталь техники и по-настоящему заботится о результате. За 3 месяца я похудела на 12 кг и чувствую себя на 10 лет моложе. Очень рекомендую всем, кто серьёзно настроен!',
        },
        rating: 5,
        timeAgo: { en: '3 months ago', ru: '3 месяца назад' },
      },
      {
        name: { en: 'Pavel K.', ru: 'Павел К.' },
        desc: {
          en: 'Best personal trainer in Limassol, period. I work 12+ hours a day and Illarion built a program that fits my crazy schedule perfectly. Lost 15 kg in 4 months. The app for tracking sessions is super convenient too!',
          ru: 'Лучший персональный тренер в Лимассоле, точка. Я работаю 12+ часов в день, а Илларион составил программу, которая идеально вписалась в мой безумный график. Минус 15 кг за 4 месяца. Приложение для отслеживания тренировок тоже супер удобное!',
        },
        rating: 5,
        timeAgo: { en: '2 months ago', ru: '2 месяца назад' },
      },
      {
        name: { en: 'Veronika O.', ru: 'Вероника О.' },
        desc: {
          en: 'I was always intimidated by personal trainers but Illarion made me feel comfortable from day one. Professional, punctual, and always explains why we do each exercise. My posture improved dramatically and I finally feel strong!',
          ru: 'Всегда стеснялась персональных тренеров, но Илларион с первого дня создал комфортную атмосферу. Профессиональный, пунктуальный, всегда объясняет зачем мы делаем каждое упражнение. Осанка улучшилась кардинально, наконец чувствую себя сильной!',
        },
        rating: 5,
        timeAgo: { en: '1 month ago', ru: '1 месяц назад' },
      },
      {
        name: { en: 'Dmitry S.', ru: 'Дмитрий С.' },
        desc: {
          en: 'Moved to Cyprus and needed a Russian-speaking trainer who understands European fitness standards. Illarion exceeded all expectations. Great equipment, flexible schedule, results speak for themselves. 5 stars well deserved!',
          ru: 'Переехал на Кипр и искал русскоязычного тренера, который понимает европейские стандарты фитнеса. Илларион превзошёл все ожидания. Отличное оборудование, гибкий график, результаты говорят сами за себя. 5 звёзд заслуженно!',
        },
        rating: 5,
        timeAgo: { en: '2 weeks ago', ru: '2 недели назад' },
      },
      {
        name: { en: 'Marina L.', ru: 'Марина Л.' },
        desc: {
          en: 'Training with Illarion for 6 months now. He doesn\'t just train you — he educates you about nutrition, recovery, and healthy lifestyle. Worth every penny. The best investment in myself I\'ve ever made.',
          ru: 'Тренируюсь с Илларионом уже 6 месяцев. Он не просто тренирует — он обучает правильному питанию, восстановлению и здоровому образу жизни. Стоит каждого цента. Лучшая инвестиция в себя, которую я когда-либо делала.',
        },
        rating: 5,
        timeAgo: { en: '1 week ago', ru: '1 неделю назад' },
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
  test2: {
    title: { en: 'PROGRESS CHECK · 2 MONTHS', ru: 'ПРОГРЕСС · 2 МЕСЯЦА' },
    subtitle: {
      en: 'You\'ve been training for 2 months. Time to measure how far you\'ve come.',
      ru: 'Вы тренируетесь уже 2 месяца. Пора измерить, насколько вы продвинулись.',
    },
    start: { en: 'Start Test #2', ru: 'Начать тест №2' },
    saveResults: { en: '', ru: '' },
    register: { en: '', ru: '' },
    continueWithout: { en: '', ru: '' },
    next: { en: 'Next', ru: 'Далее' },
    back: { en: 'Back', ru: 'Назад' },
    submit: { en: 'Get Results', ru: 'Получить результаты' },
    nameLabel: { en: 'Full Name', ru: 'Имя и фамилия' },
    phoneLabel: { en: 'Phone Number', ru: 'Номер телефона' },
    resultTitle: { en: 'Your 2-Month Progress', ru: 'Ваш прогресс за 2 месяца' },
    sendResults: { en: 'Results sent to trainer', ru: 'Результаты отправлены тренеру' },
    whoStandards: { en: 'Compared to your starting point', ru: 'В сравнении со стартовой точкой' },
    questions: [
      { q: { en: 'How has your weight changed over 2 months?', ru: 'Как изменился ваш вес за 2 месяца?' }, options: { en: ['Gained 3+ kg of extra weight', 'No changes / slight gain', 'Lost 1-3 kg or gained muscle', 'Lost 4+ kg or clear muscle gain'], ru: ['Набрал 3+ кг лишних', 'Без изменений / небольшой набор', 'Снижение 1-3 кг или прирост мышц', 'Снижение 4+ кг или явный прирост мышц'] }, scores: [1, 2, 4, 3] },
      { q: { en: 'What do you see in the mirror?', ru: 'Что вы видите в зеркале?' }, options: { en: ['No difference', 'Small changes', 'Visibly better', 'Completely transformed'], ru: ['Не вижу разницы', 'Небольшие изменения', 'Заметно лучше выгляжу', 'Кардинально изменился'] }, scores: [1, 2, 4, 3] },
      { q: { en: 'How is your endurance?', ru: 'Как ваша выносливость?' }, options: { en: ['Got worse', 'No changes', 'Easier', 'Much easier, longer workouts'], ru: ['Хуже стало', 'Без изменений', 'Стало легче', 'Намного легче, дольше тренируюсь'] }, scores: [1, 2, 4, 3] },
      { q: { en: 'How is your strength?', ru: 'Как ваша сила?' }, options: { en: ['Weaker', 'No changes', 'Stronger', 'Much stronger, new PRs'], ru: ['Слабее', 'Без изменений', 'Стал сильнее', 'Значительно сильнее, новые рекорды'] }, scores: [1, 2, 4, 3] },
      { q: { en: 'Joint or back pain?', ru: 'Боли в суставах или спине?' }, options: { en: ['Got worse', 'No changes', 'Reduced', 'Completely gone'], ru: ['Усилились', 'Без изменений', 'Уменьшились', 'Полностью прошли'] }, scores: [1, 2, 4, 3] },
      { q: { en: 'How often do you skip workouts?', ru: 'Как часто пропускаете тренировки?' }, options: { en: ['Often', 'Sometimes', 'Rarely', 'Almost never'], ru: ['Часто пропускаю', 'Иногда', 'Редко', 'Почти не пропускаю'] }, scores: [1, 2, 3, 4] },
      { q: { en: 'Do you control your nutrition?', ru: 'Контролируете ли питание?' }, options: { en: ['Don\'t track at all', 'Sometimes pay attention', 'Eat mindfully more often', 'Nutrition is systematic'], ru: ['Не слежу за питанием', 'Иногда обращаю внимание', 'Чаще ем осознанно', 'Питание стало системным'] }, scores: [1, 2, 3, 4] },
      { q: { en: 'Energy level during the day?', ru: 'Уровень энергии в течение дня?' }, options: { en: ['Constantly tired', 'Sometimes energetic', 'Generally fresh', 'Plenty of energy'], ru: ['Постоянно уставший', 'Иногда есть силы', 'В целом бодрый', 'Энергии хватает на всё'] }, scores: [1, 2, 3, 4] },
      { q: { en: 'Sleep quality?', ru: 'Качество сна?' }, options: { en: ['Sleep poorly', 'No changes', 'Better', 'Sleep great'], ru: ['Сплю плохо', 'Без изменений', 'Стало лучше', 'Сплю отлично'] }, scores: [1, 2, 3, 4] },
      { q: { en: 'New goals?', ru: 'Новые цели?' }, options: { en: ['Want to quit', 'Not sure', 'Ready to continue', 'Ready to raise the bar'], ru: ['Хочу всё бросить', 'Не уверен', 'Готов продолжать', 'Готов поднять планку'] }, scores: [1, 2, 3, 4] },
    ],
  },
} as const;
