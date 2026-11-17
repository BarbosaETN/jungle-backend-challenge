import type { WagerTransaction } from './wager-transaction';

export interface WagerTransactionRepository {
  findById(id: string): Promise<WagerTransaction | null>;

  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<WagerTransaction | null>;

  save(transaction: WagerTransaction): Promise<void>;
}