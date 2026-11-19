import type { LedgerEntry } from './ledger-entry';

export interface LedgerEntryRepository {
  findById(id: string): Promise<LedgerEntry | null>;

  findByTransactionId(
    transactionId: string,
  ): Promise<LedgerEntry | null>;

  findByWalletId(walletId: string): Promise<LedgerEntry[]>;

  save(entry: LedgerEntry): Promise<void>;
}