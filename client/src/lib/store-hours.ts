const DEFAULT_OPENING_HOUR = 8;
const DEFAULT_CLOSING_HOUR = 21;

function normalizeHour(value: unknown, fallback: number): number {
  const hour = Number(value);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : fallback;
}

export function getStoreBusinessHours(store: { open?: unknown; close?: unknown; openingHour?: unknown; closingHour?: unknown }) {
  return {
    openingHour: normalizeHour(store.openingHour ?? store.open, DEFAULT_OPENING_HOUR),
    closingHour: normalizeHour(store.closingHour ?? store.close, DEFAULT_CLOSING_HOUR),
  };
}

/** Supports a continuous schedule that may pass midnight, for example 19:00–02:00. */
export function isStoreOpenAtHour(
  store: { open?: unknown; close?: unknown; openingHour?: unknown; closingHour?: unknown },
  hour = new Date().getHours(),
): boolean {
  const { openingHour, closingHour } = getStoreBusinessHours(store);
  const currentHour = normalizeHour(hour, new Date().getHours());

  if (openingHour === closingHour) return false;
  return openingHour < closingHour
    ? currentHour >= openingHour && currentHour < closingHour
    : currentHour >= openingHour || currentHour < closingHour;
}
