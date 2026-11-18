import { Money } from '../../domain/money/money';
import { Wallet } from '../../domain/wallet/wallet';
import { WalletConcurrencyError } from '../../domain/wallet/errors/wallet-concurrency.error';
import { WalletRepository } from '../../domain/wallet/wallet.repository';
import { WalletConcurrencyService } from './wallet-concurrency.service';

describe('WalletConcurrencyService', () => {
  let service: WalletConcurrencyService;
  let repository: jest.Mocked<WalletRepository>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByPlayerAndCurrency: jest.fn(),
      save: jest.fn(),
    };

    service = new WalletConcurrencyService(repository);
  });

  it('should reload the wallet and retry after a concurrency conflict', async () => {
    const walletV1 = Wallet.restore(
      'wallet-123',
      'player-123',
      Money.from('100.00', 'BRL'),
      1,
    );

    const walletV2 = Wallet.restore(
      'wallet-123',
      'player-123',
      Money.from('70.00', 'BRL'),
      2,
    );

    repository.findById
      .mockResolvedValueOnce(walletV1)
      .mockResolvedValueOnce(walletV2);

    repository.save
      .mockRejectedValueOnce(new WalletConcurrencyError('wallet-123', 1))
      .mockResolvedValueOnce();

    await service.execute('wallet-123', (wallet) => {
      wallet.debit(Money.from('50.00', 'BRL'));
    });

    expect(repository.findById).toHaveBeenCalledTimes(2);
    expect(repository.save).toHaveBeenCalledTimes(2);

    expect(walletV1.currentBalance.amount).toBe('50.00');
    expect(walletV2.currentBalance.amount).toBe('20.00');
    expect(walletV2.currentVersion).toBe(2);
  });

  it('should stop after reaching the maximum number of attempts', async () => {
    const walletV1 = Wallet.restore(
      'wallet-123',
      'player-123',
      Money.from('100.00', 'BRL'),
      1,
    );

    const walletV2 = Wallet.restore(
      'wallet-123',
      'player-123',
      Money.from('100.00', 'BRL'),
      2,
    );

    const walletV3 = Wallet.restore(
      'wallet-123',
      'player-123',
      Money.from('100.00', 'BRL'),
      3,
    );

    repository.findById
      .mockResolvedValueOnce(walletV1)
      .mockResolvedValueOnce(walletV2)
      .mockResolvedValueOnce(walletV3);

    repository.save.mockRejectedValue(
      new WalletConcurrencyError('wallet-123', 1),
    );

    await expect(
      service.execute(
        'wallet-123',
        (currentWallet) => {
          currentWallet.debit(Money.from('50.00', 'BRL'));
        },
        3,
      ),
    ).rejects.toBeInstanceOf(WalletConcurrencyError);

    expect(repository.findById).toHaveBeenCalledTimes(3);
    expect(repository.save).toHaveBeenCalledTimes(3);
  });

  it('should propagate non-concurrency errors', async () => {
    const wallet = Wallet.restore(
      'wallet-123',
      'player-123',
      Money.from('100.00', 'BRL'),
      1,
    );

    repository.findById.mockResolvedValue(wallet);

    const error = new Error('unexpected error');

    repository.save.mockRejectedValue(error);

    await expect(
      service.execute('wallet-123', (currentWallet) => {
        currentWallet.credit(Money.from('50.00', 'BRL'));
      }),
    ).rejects.toBe(error);

    expect(repository.findById).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });
});
