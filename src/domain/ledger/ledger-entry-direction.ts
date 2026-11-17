export const LEDGER_ENTRY_DIRECTIONS = [
  'DEBIT',
  'CREDIT',
] as const;

export type LedgerEntryDirection =
  (typeof LEDGER_ENTRY_DIRECTIONS)[number];