import { MikroORM } from '@mikro-orm/postgresql';

import { IdempotencyService } from './idempotency.service';
import mikroOrmConfig from '../../infrastructure/database/mikro-orm.config';
import { MikroOrmWagerTransactionRepository } from '../../infrastructure/database/repositories/mikro-orm-wager-transaction.repository';
import { WagerTransactionEntity } from '../../infrastructure/database/entities/wager-transaction.entity';
import { WalletEntity } from '../../infrastructure/database/entities/wallet.entity';
import { LedgerEntryEntity } from '../../infrastructure/database/entities/ledger-entry.entity';
import { Money } from '../../domain/money/money';
import { WagerTransaction } from '../../domain/wager-transaction/wager-transaction';

describe('IdempotencyService integration', () => {
  let orm: MikroORM;
  let service: IdempotencyService;
  let wallet: WalletEntity;

  beforeAll(async () => {
    orm = await MikroORM.init(mikroOrmConfig);

    const repository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    service = new IdempotencyService(repository);
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

  it('should return NEW when the idempotency key does not exist', async () => {
    const result = await service.resolve(
      'idempotency-new',
      'a'.repeat(64),
    );

    expect(result).toEqual({
      type: 'NEW',
    });
  });

  it('should return REPLAY when the key exists with the same payload hash', async () => {
    const repository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    const transaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-1',
      idempotencyKey: 'idempotency-replay',
      payloadHash: 'a'.repeat(64),
      walletId: wallet.id,
      playerId: wallet.playerId,
      roundId: 'round-1',
      gameId: 'game-1',
      amount: Money.from('10.00', 'BRL'),
      kind: 'BET',
    });

    await repository.save(transaction);

    const result = await service.resolve(
      'idempotency-replay',
      'a'.repeat(64),
    );

    expect(result.type).toBe('REPLAY');

    if (result.type === 'REPLAY') {
      expect(result.transaction.transactionId).toBe(
        transaction.transactionId,
      );
    }
  });

  it('should return CONFLICT when the key exists with a different payload hash', async () => {
    const repository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    const transaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-2',
      idempotencyKey: 'idempotency-conflict',
      payloadHash: 'a'.repeat(64),
      walletId: wallet.id,
      playerId: wallet.playerId,
      roundId: 'round-2',
      gameId: 'game-2',
      amount: Money.from('10.00', 'BRL'),
      kind: 'BET',
    });

    await repository.save(transaction);

    const result = await service.resolve(
      'idempotency-conflict',
      'b'.repeat(64),
    );

    expect(result).toEqual({
      type: 'CONFLICT',
    });
  });
});