import { MikroORM } from '@mikro-orm/postgresql';

import { Money } from '../../domain/money/money';
import { Wallet } from '../../domain/wallet/wallet';
import mikroOrmConfig from '../../infrastructure/database/mikro-orm.config';
import { WalletEntity } from '../../infrastructure/database/entities/wallet.entity';
import { LedgerEntryEntity } from '../../infrastructure/database/entities/ledger-entry.entity';
import { WagerTransactionEntity } from '../../infrastructure/database/entities/wager-transaction.entity';
import { MikroOrmWalletRepository } from '../../infrastructure/database/repositories/mikro-orm-wallet.repository';
import { WalletConcurrencyService } from './wallet-concurrency.service';
import { WalletConcurrencyError } from '../../domain/wallet/errors/wallet-concurrency.error';

describe('Wallet concurrency + retry integration', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init(mikroOrmConfig);
  });

  afterAll(async () => {
    await orm.close(true);
  });

  beforeEach(async () => {
    await orm.em.nativeDelete(LedgerEntryEntity, {});
    await orm.em.nativeDelete(WagerTransactionEntity, {});
    await orm.em.nativeDelete(WalletEntity, {});
  });

  it('should resolve a concurrent update through retry', async () => {
    const setupRepository = new MikroOrmWalletRepository(orm.em.fork());

    const wallet = Wallet.create('player-retry', Money.from('100.00', 'BRL'));

    await setupRepository.save(wallet);

    const repositoryA = new MikroOrmWalletRepository(orm.em.fork());
    const repositoryB = new MikroOrmWalletRepository(orm.em.fork());

    const walletA = await repositoryA.findById(wallet.walletId);
    const walletB = await repositoryB.findById(wallet.walletId);

    expect(walletA).not.toBeNull();
    expect(walletB).not.toBeNull();

    // A vence a disputa: R$100 → R$70 / v1 → v2
    walletA!.debit(Money.from('30.00', 'BRL'));
    await repositoryA.save(walletA!);

    // B ainda está trabalhando com a versão antiga.
    walletB!.debit(Money.from('50.00', 'BRL'));

    // Primeira tentativa de B deve falhar.
    await expect(repositoryB.save(walletB!)).rejects.toThrow(
      'Wallet version conflict',
    );

    // Agora o retry recarrega a versão atual e reaplica o débito.
    const retryService = new WalletConcurrencyService(repositoryB);

    await retryService.execute(wallet.walletId, (currentWallet) => {
      currentWallet.debit(Money.from('50.00', 'BRL'));
    });

    const verificationRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWallet = await verificationRepository.findById(wallet.walletId);

    expect(finalWallet).not.toBeNull();
    expect(finalWallet?.currentBalance.amount).toBe('20.00');
    expect(finalWallet?.currentVersion).toBe(3);
  });

  it('should detect a concurrent update when two operations run simultaneously', async () => {
    const setupRepository = new MikroOrmWalletRepository(orm.em.fork());

    const wallet = Wallet.create(
      'player-concurrent',
      Money.from('100.00', 'BRL'),
    );

    await setupRepository.save(wallet);

    const repositoryA = new MikroOrmWalletRepository(orm.em.fork());
    const repositoryB = new MikroOrmWalletRepository(orm.em.fork());

    const walletA = await repositoryA.findById(wallet.walletId);
    const walletB = await repositoryB.findById(wallet.walletId);

    expect(walletA).not.toBeNull();
    expect(walletB).not.toBeNull();

    walletA!.debit(Money.from('30.00', 'BRL'));
    walletB!.debit(Money.from('50.00', 'BRL'));

    const results = await Promise.allSettled([
      repositoryA.save(walletA!),
      repositoryB.save(walletB!),
    ]);

    const successfulUpdates = results.filter(
      (result) => result.status === 'fulfilled',
    );

    const failedUpdates = results.filter(
      (result) => result.status === 'rejected',
    );

    expect(successfulUpdates).toHaveLength(1);
    expect(failedUpdates).toHaveLength(1);

    const failedResult = failedUpdates[0];

    expect(failedResult.status).toBe('rejected');
    expect(failedResult.reason).toBeInstanceOf(WalletConcurrencyError);

    const verificationRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWallet = await verificationRepository.findById(wallet.walletId);

    expect(finalWallet).not.toBeNull();
    expect(['70.00', '50.00']).toContain(finalWallet!.currentBalance.amount);
    expect(finalWallet!.currentVersion).toBe(2);
  });
});
