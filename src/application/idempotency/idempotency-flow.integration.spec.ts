import { MikroORM } from '@mikro-orm/postgresql';

import { Money } from '../../domain/money/money';
import { WagerTransaction } from '../../domain/wager-transaction/wager-transaction';
import { LedgerEntryEntity } from '../../infrastructure/database/entities/ledger-entry.entity';
import { WagerTransactionEntity } from '../../infrastructure/database/entities/wager-transaction.entity';
import { WalletEntity } from '../../infrastructure/database/entities/wallet.entity';
import mikroOrmConfig from '../../infrastructure/database/mikro-orm.config';
import { MikroOrmWagerTransactionRepository } from '../../infrastructure/database/repositories/mikro-orm-wager-transaction.repository';
import { IdempotencyService } from './idempotency.service';
import { generateIdempotencyPayloadHash } from './idempotency-request-hash';

describe('Idempotency flow integration', () => {
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

  it('should return REPLAY when the same payload is submitted again', async () => {
    const request = {
      idempotencyKey: 'idempotency-flow-1',
      payload: {
        providerId: 'provider-1',
        externalTransactionId: 'external-1',
        walletId: wallet.id,
        playerId: wallet.playerId,
        roundId: 'round-1',
        gameId: 'game-1',
        amount: '10.00',
        currency: 'BRL',
        kind: 'BET',
      },
    };

    const payloadHash = generateIdempotencyPayloadHash(request);

    const transaction = WagerTransaction.create({
      providerId: request.payload.providerId,
      externalTransactionId: request.payload.externalTransactionId,
      idempotencyKey: request.idempotencyKey,
      payloadHash,
      walletId: request.payload.walletId,
      playerId: request.payload.playerId,
      roundId: request.payload.roundId,
      gameId: request.payload.gameId,
      amount: Money.from(
        request.payload.amount,
        request.payload.currency as 'BRL' | 'USD' | 'EUR',
      ),
      kind: request.payload.kind as 'BET',
    });

    const repository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    await repository.save(transaction);

    const replayRequest = {
      idempotencyKey: request.idempotencyKey,
      payload: {
        kind: 'BET',
        amount: '10.00',
        currency: 'BRL',
        gameId: 'game-1',
        roundId: 'round-1',
        playerId: 'player-123',
        walletId: wallet.id,
        providerId: 'provider-1',
        externalTransactionId: 'external-1',
      },
    };

    const replayHash = generateIdempotencyPayloadHash(replayRequest);

    const result = await service.resolve(
      replayRequest.idempotencyKey,
      replayHash,
    );

    expect(result.type).toBe('REPLAY');

    if (result.type === 'REPLAY') {
      expect(result.transaction.transactionId).toBe(
        transaction.transactionId,
      );
    }
  });

  it('should return CONFLICT when the same key is used with a different payload', async () => {
    const originalPayload = {
      providerId: 'provider-1',
      externalTransactionId: 'external-2',
      amount: '10.00',
      currency: 'BRL',
      kind: 'BET',
    };

    const request = {
      idempotencyKey: 'idempotency-flow-2',
      payload: originalPayload,
    };

    const payloadHash = generateIdempotencyPayloadHash(request);

    const transaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-2',
      idempotencyKey: request.idempotencyKey,
      payloadHash,
      walletId: wallet.id,
      playerId: wallet.playerId,
      roundId: 'round-2',
      gameId: 'game-2',
      amount: Money.from('10.00', 'BRL'),
      kind: 'BET',
    });

    const repository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    await repository.save(transaction);

    const conflictingRequest = {
      idempotencyKey: request.idempotencyKey,
      payload: {
        ...originalPayload,
        amount: '20.00',
      },
    };

    const conflictingHash = generateIdempotencyPayloadHash(
      conflictingRequest,
    );

    const result = await service.resolve(
      conflictingRequest.idempotencyKey,
      conflictingHash,
    );

    expect(result).toEqual({
      type: 'CONFLICT',
    });
  });
});
