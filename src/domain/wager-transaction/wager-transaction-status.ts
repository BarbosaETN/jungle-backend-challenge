export const WAGER_TRANSACTION_STATUSES = [
  'PENDING',
  'PENDING_REFERENCE',
  'PROCESSED',
  'REJECTED',
  'FAILED',
] as const;

export type WagerTransactionStatus =
  (typeof WAGER_TRANSACTION_STATUSES)[number];