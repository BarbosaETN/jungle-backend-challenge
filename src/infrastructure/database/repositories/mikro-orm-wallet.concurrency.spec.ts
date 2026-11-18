import { MikroORM } from '@mikro-orm/postgresql';
import { Money } from '../../../domain/money/money';
import { Wallet } from '../../../domain/wallet/wallet';
import { WalletConcurrencyError } from '../../../domain/wallet/errors/wallet-concurrency.error';
import mikroOrmConfig from '../../database/mikro-orm.config';
import { WalletEntity } from '../entities/wallet.entity';
import { LedgerEntryEntity } from '../entities/ledger-entry.entity';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';
import { MikroOrmWalletRepository } from './mikro-orm-wallet.repository';

describe('MikroOrmWalletRepository concurrency', () => {
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

  it('should reject one of two concurrent updates using the same wallet version', async () => {
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

    const successful = results.filter(
      (result) => result.status === 'fulfilled',
    );

    const rejected = results.filter(
      (result) => result.status === 'rejected',
    );

    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(rejected[0]).toMatchObject({
      status: 'rejected',
      reason: expect.any(WalletConcurrencyError),
    });

    const verificationRepository = new MikroOrmWalletRepository(
      orm.em.fork(),
    );

    const finalWallet = await verificationRepository.findById(
      wallet.walletId,
    );

    expect(finalWallet).not.toBeNull();
    expect(finalWallet?.currentVersion).toBe(2);

    expect(['70.00', '50.00']).toContain(
      finalWallet?.currentBalance.amount,
    );
  });
});