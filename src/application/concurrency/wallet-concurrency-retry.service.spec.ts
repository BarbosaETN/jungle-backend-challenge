import { WalletConcurrencyError } from '../../domain/wallet/errors/wallet-concurrency.error';
import { WalletConcurrencyRetryService } from './wallet-concurrency-retry.service';

describe('WalletConcurrencyRetryService', () => {
  let service: WalletConcurrencyRetryService;

  beforeEach(() => {
    service = new WalletConcurrencyRetryService();
  });

  it('should retry when a wallet concurrency error occurs', async () => {
    let attempts = 0;

    const result = await service.execute(async () => {
      attempts++;

      if (attempts < 2) {
        throw new WalletConcurrencyError('wallet-123', 1);
      }

      return 'success';
    });

    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  it('should throw after reaching the maximum number of attempts', async () => {
    let attempts = 0;

    await expect(
      service.execute(async () => {
        attempts++;
        throw new WalletConcurrencyError('wallet-123', 1);
      }, 3),
    ).rejects.toBeInstanceOf(WalletConcurrencyError);

    expect(attempts).toBe(3);
  });

  it('should not retry non-concurrency errors', async () => {
    let attempts = 0;
    const error = new Error('unexpected error');

    await expect(
      service.execute(async () => {
        attempts++;
        throw error;
      }),
    ).rejects.toBe(error);

    expect(attempts).toBe(1);
  });

  it('should reject an invalid maximum number of attempts', async () => {
    await expect(
      service.execute(async () => 'success', 0),
    ).rejects.toThrow('maxAttempts must be greater than zero');
  });
});