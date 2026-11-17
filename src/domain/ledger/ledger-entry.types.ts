import type { Money } from '../money/money';
import type { LedgerEntryDirection } from './ledger-entry-direction';

export interface CreateLedgerEntryInput {
  walletId: string;
  transactionId: string;
  direction: LedgerEntryDirection;
  amount: Money;
  balanceBefore: Money;
  balanceAfter: Money;
}

export interface RestoreLedgerEntryInput
  extends CreateLedgerEntryInput {
  id: string;
  createdAt: Date;
}