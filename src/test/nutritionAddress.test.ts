import { describe, expect, it } from "vitest";
import { nutritionAddressPolicy } from "../../supabase/functions/_shared/nutritionAddress";

describe("personal nutrition address policy", () => {
  it("uses the approved playful name only for Eugene Valuev's profile", () => {
    expect(nutritionAddressPolicy("aa9a11b5-b1ab-423c-8889-c55d2ccf3f11")).toEqual({
      ru: "Женчик", en: "Zhenchik", seriousAdvice: true,
    });
  });
  it("does not assign the policy to another profile or a matching name", () => {
    expect(nutritionAddressPolicy("aa9a11b5-b1ab-423c-8889-c55d2ccf3f12")).toBeUndefined();
    expect(nutritionAddressPolicy("Eugene Valuev")).toBeUndefined();
  });
});