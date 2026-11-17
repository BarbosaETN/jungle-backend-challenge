import { MikroORM } from '@mikro-orm/postgresql';
import { Money } from '../../../domain/money/money';
import { Wallet } from '../../../domain/wallet/wallet';
import mikroOrmConfig from '../../database/mikro-orm.config';
import { WalletEntity } from '../entities/wallet.entity';
import { MikroOrmWalletRepository } from './mikro-orm-wallet.repository';
import { LedgerEntryEntity } from '../entities/ledger-entry.entity';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';

describe('MikroOrmWalletRepository', () => {
  let orm: MikroORM;
  let repository: MikroOrmWalletRepository;

  beforeAll(async () => {
    orm = await MikroORM.init(mikroOrmConfig);
    repository = new MikroOrmWalletRepository(orm.em.fork());
  });

  afterAll(async () => {
    await orm.close(true);
  });

  beforeEach(async () => {
    await orm.em.nativeDelete(LedgerEntryEntity, {});
    await orm.em.nativeDelete(WagerTransactionEntity, {});
    await orm.em.nativeDelete(WalletEntity, {});
  });

  it('should save and find a wallet by id', async () => {
    const wallet = Wallet.create('player-123', Money.from('100.00', 'BRL'));

    await repository.save(wallet);

    const foundWallet = await repository.findById(wallet.walletId);

    expect(foundWallet).not.toBeNull();
    expect(foundWallet?.walletId).toBe(wallet.walletId);
    expect(foundWallet?.ownerId).toBe('player-123');
    expect(foundWallet?.currentBalance.amount).toBe('100.00');
    expect(foundWallet?.currentBalance.currencyCode).toBe('BRL');
    expect(foundWallet?.currentVersion).toBe(1);
  });

  it('should find a wallet by player and currency', async () => {
    const wallet = Wallet.create('player-456', Money.from('250.00', 'USD'));

    await repository.save(wallet);

    const foundWallet = await repository.findByPlayerAndCurrency(
      'player-456',
      'USD',
    );

    expect(foundWallet).not.toBeNull();
    expect(foundWallet?.walletId).toBe(wallet.walletId);
    expect(foundWallet?.ownerId).toBe('player-456');
    expect(foundWallet?.currentBalance.amount).toBe('250.00');
    expect(foundWallet?.currentBalance.currencyCode).toBe('USD');
  });

  it('should return null when wallet does not exist', async () => {
    const foundWallet = await repository.findById(
      '00000000-0000-0000-0000-000000000000',
    );

    expect(foundWallet).toBeNull();
  });

  it('should update an existing wallet', async () => {
    const wallet = Wallet.create('player-789', Money.from('100.00', 'BRL'));

    await repository.save(wallet);

    wallet.credit(Money.from('50.00', 'BRL'));

    await repository.save(wallet);

    const foundWallet = await repository.findById(wallet.walletId);

    expect(foundWallet).not.toBeNull();
    expect(foundWallet?.currentBalance.amount).toBe('150.00');
    expect(foundWallet?.currentVersion).toBe(1);
  });
});
