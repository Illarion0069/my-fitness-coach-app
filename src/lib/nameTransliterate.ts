// Latin -> Russian name transliteration (practical Russian orthography).
// Used so client names render in Cyrillic when the UI language is RU.

const EXCEPTIONS: Record<string, string> = {
  illarion: 'Илларион',
  ilarion: 'Илларион',
  alexander: 'Александр',
  alexandr: 'Александр',
  aleksandr: 'Александр',
  alex: 'Алекс',
  andrey: 'Андрей',
  andrei: 'Андрей',
  arsenii: 'Арсений',
  arseniy: 'Арсений',
  bohdan: 'Богдан',
  bogdan: 'Богдан',
  daniil: 'Даниил',
  daniel: 'Даниэль',
  dmitry: 'Дмитрий',
  dmitrii: 'Дмитрий',
  evgeny: 'Евгений',
  george: 'Георгий',
  ivan: 'Иван',
  john: 'Джон',
  julia: 'Юлия',
  katerina: 'Катерина',
  ekaterina: 'Екатерина',
  maria: 'Мария',
  margo: 'Марго',
  michael: 'Майкл',
  mikhail: 'Михаил',
  nikita: 'Никита',
  nikolay: 'Николай',
  oleg: 'Олег',
  pavel: 'Павел',
  peter: 'Питер',
  rodion: 'Родион',
  roman: 'Роман',
  sergey: 'Сергей',
  sergei: 'Сергей',
  vladimir: 'Владимир',
  yuri: 'Юрий',
};

const DIGRAPHS: Array<[string, string]> = [
  ['shch', 'щ'],
  ['sch', 'щ'],
  ['tch', 'ч'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['ts', 'ц'],
  ['ph', 'ф'],
  ['th', 'т'],
  ['ya', 'я'],
  ['yu', 'ю'],
  ['ye', 'е'],
  ['yo', 'ё'],
  ['io', 'ио'],
  ['ee', 'и'],
  ['oo', 'у'],
  ['ck', 'к'],
  ['ia', 'ия'],
];

const SINGLES: Record<string, string> = {
  a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и',
  j: 'дж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р',
  s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс', y: 'й', z: 'з',
  "'": '', '`': '', '’': '',
};

const hasCyrillic = (s: string) => /[а-яё]/i.test(s);

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const transliterateWord = (word: string): string => {
  const lower = word.toLowerCase();
  if (EXCEPTIONS[lower]) return EXCEPTIONS[lower];

  let out = '';
  let i = 0;
  while (i < lower.length) {
    let matched = false;
    for (const [latin, cyr] of DIGRAPHS) {
      if (lower.startsWith(latin, i)) {
        out += cyr;
        i += latin.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = lower[i];
    out += SINGLES[ch] ?? ch;
    i += 1;
  }

  // "й" at word start reads as "и"
  out = out.replace(/^й/, 'И'.toLowerCase());
  return capitalize(out);
};

/** Convert a Latin-script name to Russian. Returns input unchanged if already Cyrillic. */
export const toRussianName = (name?: string | null): string => {
  if (!name) return '';
  if (hasCyrillic(name)) return name;
  return name
    .split(/(\s+|-)/)
    .map((part) => (/^[\s-]+$/.test(part) ? part : transliterateWord(part)))
    .join('');
};

/** Localize a name for the current UI language. */
export const localizeName = (name: string | null | undefined, lang: string): string =>
  lang === 'ru' ? toRussianName(name) : (name || '');
