type AddressPolicy = { ru: string; en: string; seriousAdvice: boolean };

// Profile IDs, never name matching: names are editable and not unique.
const ADDRESS_POLICIES: Record<string, AddressPolicy> = {
  "aa9a11b5-b1ab-423c-8889-c55d2ccf3f11": {
    ru: "Женчик",
    en: "Zhenchik",
    seriousAdvice: true,
  },
};

export function nutritionAddressPolicy(userId: string): AddressPolicy | undefined {
  return ADDRESS_POLICIES[userId];
}

export function enforcePersonalAddress(text: string, name: string): string {
  if (!text.trim()) return text;
  // Replace an existing opening address, rather than adding a second name.
  const body = text.trim().replace(/^(?:(?:Женчик|Женёк|Женюня|Женя|Евгений|Eugene|Evgeniy|Zhenchik),\s*)+/iu, "");
  return `${name}, ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
}