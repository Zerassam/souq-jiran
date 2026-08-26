import { describe, expect, it } from "vitest";
import { getStoreBusinessHours, isStoreOpenAtHour } from "../client/src/lib/store-hours";

describe("ساعات عمل المتجر", () => {
  it("يعرض الساعات الافتراضية عند غياب قيم قديمة من السجل", () => {
    expect(getStoreBusinessHours({})).toEqual({ openingHour: 8, closingHour: 21 });
    expect(isStoreOpenAtHour({}, 12)).toBe(true);
    expect(isStoreOpenAtHour({}, 21)).toBe(false);
  });

  it("يعامل ساعة الإغلاق كحد غير مشمول", () => {
    expect(isStoreOpenAtHour({ open: 8, close: 21 }, 8)).toBe(true);
    expect(isStoreOpenAtHour({ open: 8, close: 21 }, 20)).toBe(true);
    expect(isStoreOpenAtHour({ open: 8, close: 21 }, 21)).toBe(false);
  });

  it("يدعم المتجر الذي يغلق بعد منتصف الليل", () => {
    const nightStore = { openingHour: 19, closingHour: 2 };
    expect(isStoreOpenAtHour(nightStore, 21)).toBe(true);
    expect(isStoreOpenAtHour(nightStore, 1)).toBe(true);
    expect(isStoreOpenAtHour(nightStore, 2)).toBe(false);
  });
});
