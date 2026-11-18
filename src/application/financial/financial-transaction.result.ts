import type { WagerTransaction } from '../../domain/wager-transaction/wager-transaction';

export interface FinancialTransactionResult {
  transaction: WagerTransaction;
  replayed: boolean;
}