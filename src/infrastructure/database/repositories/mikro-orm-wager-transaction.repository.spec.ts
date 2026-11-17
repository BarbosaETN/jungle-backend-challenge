import { MikroORM } from '@mikro-orm/postgresql';

import { Money } from '../../../domain/money/money';
import { WagerTransaction } from '../../../domain/wager-transaction/wager-transaction';
import mikroOrmConfig from '../mikro-orm.config';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';
import { WalletEntity } from '../entities/wallet.entity';
import { MikroOrmWagerTransactionRepository } from './mikro-orm-wager-transaction.repository';
import { LedgerEntryEntity } from '../entities/ledger-entry.entity';

describe('MikroOrmWagerTransactionRepository', () => {
  let orm: MikroORM;
  let repository: MikroOrmWagerTransactionRepository;
  let wallet: WalletEntity;

  beforeAll(async () => {
    orm = await MikroORM.init(mikroOrmConfig);
    repository = new MikroOrmWagerTransactionRepository(orm.em.fork());
  });

  afterAll(async () => {
    await orm.close(true);
  });

  beforeEach(async () => {
    const em = orm.em.fork();

    await em.nativeDelete(LedgerEntryEntity, {});
    await em.nativeDelete(WagerTransactionEntity, {});
    await em.nativeDelete(WalletEntity, {});

    wallet = new WalletEntity();
    wallet.id = crypto.randomUUID();
    wallet.playerId = 'player-123';
    wallet.balance = '100.00';
    wallet.currency = 'BRL';
    wallet.version = 1;

    em.persist(wallet);
    await em.flush();
  });

  it('should save and find a transaction by id', async () => {
    const transaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-1',
      idempotencyKey: 'idempotency-1',
      payloadHash: 'a'.repeat(64),
      walletId: wallet.id,
      playerId: wallet.playerId,
      roundId: 'round-1',
      gameId: 'game-1',
      amount: Money.from('10.00', 'BRL'),
      kind: 'BET',
    });

    await repository.save(transaction);

    const found = await repository.findById(transaction.transactionId);

    expect(found).not.toBeNull();
    expect(found?.transactionId).toBe(transaction.transactionId);
    expect(found?.provider).toBe('provider-1');
    expect(found?.externalId).toBe('external-1');
    expect(found?.idempotency).toBe('idempotency-1');
    expect(found?.value.amount).toBe('10.00');
    expect(found?.value.currencyCode).toBe('BRL');
    expect(found?.currentStatus).toBe('PENDING');
  });

  it('should find a transaction by idempotency key', async () => {
    const transaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-2',
      idempotencyKey: 'idempotency-2',
      payloadHash: 'b'.repeat(64),
      walletId: wallet.id,
      playerId: wallet.playerId,
      roundId: 'round-2',
      gameId: 'game-2',
      amount: Money.from('25.00', 'BRL'),
      kind: 'BET',
    });

    await repository.save(transaction);

    const found = await repository.findByIdempotencyKey('idempotency-2');

    expect(found).not.toBeNull();
    expect(found?.transactionId).toBe(transaction.transactionId);
  });

  it('should return null when transaction does not exist', async () => {
    const found = await repository.findById(crypto.randomUUID());

    expect(found).toBeNull();
  });

  it('should update an existing transaction', async () => {
    const transaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-3',
      idempotencyKey: 'idempotency-3',
      payloadHash: 'c'.repeat(64),
      walletId: wallet.id,
      playerId: wallet.playerId,
      roundId: 'round-3',
      gameId: 'game-3',
      amount: Money.from('50.00', 'BRL'),
      kind: 'BET',
    });

    await repository.save(transaction);

    const found = await repository.findById(transaction.transactionId);

    expect(found).not.toBeNull();
    expect(found?.value.amount).toBe('50.00');
  });

  it('should reject duplicate idempotency keys', async () => {
    const firstTransaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-1',
      idempotencyKey: 'same-key',
      payloadHash: 'a'.repeat(64),
      walletId: wallet.id,
      playerId: wallet.playerId,
      roundId: 'round-1',
      gameId: 'game-1',
      amount: Money.from('10.00', 'BRL'),
      kind: 'BET',
    });

    const secondTransaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-2',
      idempotencyKey: 'same-key',
      payloadHash: 'b'.repeat(64),
      walletId: wallet.id,
      playerId: wallet.playerId,
      roundId: 'round-2',
      gameId: 'game-2',
      amount: Money.from('20.00', 'BRL'),
      kind: 'BET',
    });

    await repository.save(firstTransaction);

    await expect(repository.save(secondTransaction)).rejects.toThrow();
  });
});
