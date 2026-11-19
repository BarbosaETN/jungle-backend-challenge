import type { Money } from '../money/money';
import type { WagerTransactionKind } from './wager-transaction-kind';
import type { WagerTransactionStatus } from './wager-transaction-status';

export interface CreateWagerTransactionInput {
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  amount: Money;
  kind: WagerTransactionKind;
  referenceExternalTransactionId?: string;
  referenceTransactionId?: string;
}

export interface RestoreWagerTransactionInput
  extends CreateWagerTransactionInput {
  id: string;
  status: WagerTransactionStatus;
  referenceExternalTransactionId?: string;
  referenceTransactionId?: string;
  failureCode?: string;
  processedAt?: Date;
  createdAt: Date;
}