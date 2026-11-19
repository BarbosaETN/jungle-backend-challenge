import type { WagerTransactionKind } from '../../domain/wager-transaction/wager-transaction-kind';
import type { Currency } from '../../domain/money/currency';

export interface FinancialTransactionRequest {
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  playerId: string;
  walletId: string;
  roundId: string;
  gameId: string;
  amount: string;
  currency: Currency;
  kind: WagerTransactionKind;
  referenceExternalTransactionId?: string;
}