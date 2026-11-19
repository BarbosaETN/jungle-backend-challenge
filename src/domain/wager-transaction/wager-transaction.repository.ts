import type { WagerTransaction } from './wager-transaction';

export interface WagerTransactionRepository {
  findById(id: string): Promise<WagerTransaction | null>;

  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<WagerTransaction | null>;

  findByProviderAndExternalId(
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null>;

  findPendingByReference(
    providerId: string,
    referenceExternalTransactionId: string,
  ): Promise<WagerTransaction[]>;

  findPendingReferences(): Promise<WagerTransaction[]>;

  save(transaction: WagerTransaction): Promise<void>;
}