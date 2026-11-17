import { Money } from '../../../domain/money/money';
import { WagerTransaction } from '../../../domain/wager-transaction/wager-transaction';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';
import { WalletEntity } from '../entities/wallet.entity';
import { WagerTransactionMapper } from './wager-transaction.mapper';

describe('WagerTransactionMapper', () => {
  const createWalletEntity = (): WalletEntity => {
    const wallet = new WalletEntity();

    wallet.id = 'wallet-123';
    wallet.playerId = 'player-123';
    wallet.balance = '500.00';
    wallet.currency = 'BRL';
    wallet.version = 1;
    wallet.createdAt = new Date('2026-11-17T12:00:00.000Z');
    wallet.updatedAt = new Date('2026-11-17T12:00:00.000Z');

    return wallet;
  };

  const createTransactionEntity = (): WagerTransactionEntity => {
    const wallet = createWalletEntity();

    const entity = new WagerTransactionEntity();

    entity.id = 'transaction-123';
    entity.providerId = 'provider-1';
    entity.externalTransactionId = 'external-123';
    entity.idempotencyKey = 'idem-123';
    entity.payloadHash = 'a'.repeat(64);
    entity.wallet = wallet;
    entity.playerId = 'player-123';
    entity.roundId = 'round-123';
    entity.gameId = 'game-123';
    entity.amount = '100.00';
    entity.currency = 'BRL';
    entity.kind = 'BET';
    entity.status = 'PROCESSED';
    entity.referenceExternalTransactionId = 'external-ref-123';
    entity.failureCode = undefined;
    entity.processedAt = new Date('2026-11-17T12:05:00.000Z');
    entity.createdAt = new Date('2026-11-17T12:00:00.000Z');

    return entity;
  };

  it('should map Entity to Domain', () => {
    const entity = createTransactionEntity();

    const transaction = WagerTransactionMapper.toDomain(entity);

    expect(transaction.transactionId).toBe('transaction-123');
    expect(transaction.provider).toBe('provider-1');
    expect(transaction.externalId).toBe('external-123');
    expect(transaction.idempotency).toBe('idem-123');
    expect(transaction.hash).toBe('a'.repeat(64));
    expect(transaction.wallet).toBe('wallet-123');
    expect(transaction.player).toBe('player-123');
    expect(transaction.round).toBe('round-123');
    expect(transaction.game).toBe('game-123');
    expect(transaction.value.amount).toBe('100.00');
    expect(transaction.value.currencyCode).toBe('BRL');
    expect(transaction.transactionKind).toBe('BET');
    expect(transaction.currentStatus).toBe('PROCESSED');
    expect(transaction.referenceExternalId).toBe(
      'external-ref-123',
    );
    expect(transaction.processedDate).toEqual(
      new Date('2026-11-17T12:05:00.000Z'),
    );
  });

  it('should map Domain to Entity', () => {
    const transaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-123',
      idempotencyKey: 'idem-123',
      payloadHash: 'a'.repeat(64),
      walletId: 'wallet-123',
      playerId: 'player-123',
      roundId: 'round-123',
      gameId: 'game-123',
      amount: Money.from('100.00', 'BRL'),
      kind: 'BET',
    });

    const wallet = createWalletEntity();

    const entity = WagerTransactionMapper.toEntity(
      transaction,
      wallet,
    );

    expect(entity.id).toBe(transaction.transactionId);
    expect(entity.providerId).toBe('provider-1');
    expect(entity.externalTransactionId).toBe('external-123');
    expect(entity.idempotencyKey).toBe('idem-123');
    expect(entity.payloadHash).toBe('a'.repeat(64));
    expect(entity.wallet).toBe(wallet);
    expect(entity.playerId).toBe('player-123');
    expect(entity.roundId).toBe('round-123');
    expect(entity.gameId).toBe('game-123');
    expect(entity.amount).toBe('100.00');
    expect(entity.currency).toBe('BRL');
    expect(entity.kind).toBe('BET');
    expect(entity.status).toBe('PENDING');
  });

  it('should preserve data through Entity to Domain to Entity', () => {
    const originalEntity = createTransactionEntity();

    const transaction = WagerTransactionMapper.toDomain(
      originalEntity,
    );

    const mappedEntity = WagerTransactionMapper.toEntity(
      transaction,
      originalEntity.wallet,
    );

    expect(mappedEntity.id).toBe(originalEntity.id);
    expect(mappedEntity.providerId).toBe(
      originalEntity.providerId,
    );
    expect(mappedEntity.externalTransactionId).toBe(
      originalEntity.externalTransactionId,
    );
    expect(mappedEntity.idempotencyKey).toBe(
      originalEntity.idempotencyKey,
    );
    expect(mappedEntity.payloadHash).toBe(
      originalEntity.payloadHash,
    );
    expect(mappedEntity.wallet).toBe(originalEntity.wallet);
    expect(mappedEntity.playerId).toBe(originalEntity.playerId);
    expect(mappedEntity.roundId).toBe(originalEntity.roundId);
    expect(mappedEntity.gameId).toBe(originalEntity.gameId);
    expect(mappedEntity.amount).toBe(originalEntity.amount);
    expect(mappedEntity.currency).toBe(originalEntity.currency);
    expect(mappedEntity.kind).toBe(originalEntity.kind);
    expect(mappedEntity.status).toBe(originalEntity.status);
    expect(mappedEntity.referenceExternalTransactionId).toBe(
      originalEntity.referenceExternalTransactionId,
    );
    expect(mappedEntity.processedAt).toEqual(
      originalEntity.processedAt,
    );
    expect(mappedEntity.createdAt).toEqual(
      originalEntity.createdAt,
    );
  });
});