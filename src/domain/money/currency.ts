export const CURRENCIES = ['BRL', 'USD', 'EUR'] as const;

export type Currency = (typeof CURRENCIES)[number];