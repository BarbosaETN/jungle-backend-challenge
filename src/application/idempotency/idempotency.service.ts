import type { WagerTransactionRepository } from '../../domain/wager-transaction/wager-transaction.repository';
import type { IdempotencyResolution } from './idempotency-resolution';

export class IdempotencyService {
  constructor(
    private readonly wagerTransactionRepository: WagerTransactionRepository,
  ) {}

  async resolve(
    idempotencyKey: string,
    payloadHash: string,
  ): Promise<IdempotencyResolution> {
    const transaction =
      await this.wagerTransactionRepository.findByIdempotencyKey(
        idempotencyKey,
      );

    if (!transaction) {
      return {
        type: 'NEW',
      };
    }

    if (transaction.hash === payloadHash) {
      return {
        type: 'REPLAY',
        transaction,
      };
    }

    return {
      type: 'CONFLICT',
    };
  }
}