type AddressPolicy = { ru: string; en: string; seriousAdvice: boolean };

const COMMON_NAMES: Array<{ aliases: string[]; ru: string; en: string }> = [
  { aliases: ["евгений", "eugene", "evgeniy", "yevgeny", "женя"], ru: "Женчик", en: "Eugene" },
  { aliases: ["анна", "anna", "аня"], ru: "Анечка", en: "Annie" },
  { aliases: ["александр", "alexander", "александра", "alexandra", "саша"], ru: "Сашенька", en: "Alex" },
  { aliases: ["дмитрий", "dmitry", "dmitri", "дима"], ru: "Димочка", en: "Dima" },
  { aliases: ["мария", "maria", "маша"], ru: "Машенька", en: "Maria" },
  { aliases: ["екатерина", "ekaterina", "катя"], ru: "Катюша", en: "Katya" },
  { aliases: ["даниил", "daniel", "даня"], ru: "Данечка", en: "Dan" },
  { aliases: ["наталья", "natalia", "наташа"], ru: "Наташенька", en: "Natalia" },
  { aliases: ["михаил", "michael", "миша"], ru: "Мишенька", en: "Mike" },
  { aliases: ["елена", "elena", "лена"], ru: "Леночка", en: "Elena" },
];

export const AFFECTIONATE_ADDRESS_INSTRUCTIONS = `GLOBAL ADDRESS STYLE (overrides previous humor rules): For EVERY client, use a warm, natural affectionate or diminutive form of their FIRST NAME in the language of the summary. No titles, epithets, extra nicknames, "champion", "dear", or additions around the name. Only the first-name address may be playful; ALL advice and the remainder of the feedback must remain serious, professional and supportive, without jokes. Use culturally natural forms only; if no confident affectionate form exists, keep the person's name and a warm tone rather than inventing a name. In summary_ru localize the name into Russian/Cyrillic (Eugene means Евгений, affectionate Женчик); in summary_en use natural English/Latin forms. Always start the summary with the chosen name followed by a comma. Explicit localized address policies below take precedence.`;

// Profile IDs, never name matching: names are editable and not unique.
const ADDRESS_POLICIES: Record<string, AddressPolicy> = {
  "aa9a11b5-b1ab-423c-8889-c55d2ccf3f11": {
    ru: "Женчик",
    en: "Zhenchik",
    seriousAdvice: true,
  },
};

export function nutritionAddressPolicy(userId: string, firstName = ""): AddressPolicy | undefined {
  const override = ADDRESS_POLICIES[userId];
  if (override) return override;
  const known = COMMON_NAMES.find(entry => entry.aliases.includes(firstName.trim().toLowerCase()));
  return known ? { ru: known.ru, en: known.en, seriousAdvice: true } : undefined;
}

export function enforcePersonalAddress(text: string, name: string, originalName = ""): string {
  if (!text.trim()) return text;
  // Replace an existing opening address, rather than adding a second name.
  const names = [name, originalName, ...COMMON_NAMES.flatMap(entry => [entry.ru, entry.en, ...entry.aliases]), "Женёк", "Женюня", "Zhenchik"]
    .filter(Boolean).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const body = text.trim().replace(new RegExp(`^(?:(?:${names.join("|")}),\\s*)+`, "iu"), "");
  return `${name}, ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
}