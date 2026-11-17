export const WAGER_TRANSACTION_KINDS = [
  'OPENING',
  'BET',
  'WIN',
  'LOSS',
  'REFUND',
  'ROLLBACK',
] as const;

export type WagerTransactionKind =
  (typeof WAGER_TRANSACTION_KINDS)[number];