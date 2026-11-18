import { WalletConcurrencyError } from '../../domain/wallet/errors/wallet-concurrency.error';

export class WalletConcurrencyRetryService {
  async execute<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    if (maxAttempts < 1) {
      throw new Error('maxAttempts must be greater than zero');
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof WalletConcurrencyError)) {
          throw error;
        }

        if (attempt === maxAttempts) {
          throw error;
        }
      }
    }

    throw new Error('Unexpected retry state');
  }
}