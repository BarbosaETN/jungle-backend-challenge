import { WalletConcurrencyError } from '../../domain/wallet/errors/wallet-concurrency.error';
import { Wallet } from '../../domain/wallet/wallet';
import { WalletRepository } from '../../domain/wallet/wallet.repository';

export class WalletConcurrencyService {
  constructor(
    private readonly walletRepository: WalletRepository,
  ) {}

  async execute(
    walletId: string,
    operation: (wallet: Wallet) => void,
    maxAttempts = 3,
  ): Promise<void> {
    if (maxAttempts < 1) {
      throw new Error('maxAttempts must be greater than zero');
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const wallet = await this.walletRepository.findById(walletId);

      if (!wallet) {
        throw new Error(`Wallet not found: ${walletId}`);
      }

      try {
        operation(wallet);

        await this.walletRepository.save(wallet);

        return;
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