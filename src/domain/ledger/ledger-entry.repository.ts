import type { LedgerEntry } from './ledger-entry';

export interface LedgerEntryRepository {
  findById(id: string): Promise<LedgerEntry | null>;

  findByTransactionId(
    transactionId: string,
  ): Promise<LedgerEntry | null>;

  save(entry: LedgerEntry): Promise<void>;
}
