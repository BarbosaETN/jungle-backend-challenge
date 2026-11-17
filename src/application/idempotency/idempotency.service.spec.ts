import { IdempotencyService } from './idempotency.service';
import type { WagerTransactionRepository } from '../../domain/wager-transaction/wager-transaction.repository';
import { WagerTransaction } from '../../domain/wager-transaction/wager-transaction';
import { Money } from '../../domain/money/money';

describe('IdempotencyService', () => {
  let repository: jest.Mocked<WagerTransactionRepository>;
  let service: IdempotencyService;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      save: jest.fn(),
    };

    service = new IdempotencyService(repository);
  });

  it('should return NEW when the idempotency key does not exist', async () => {
    repository.findByIdempotencyKey.mockResolvedValue(null);

    const result = await service.resolve('key-123', 'hash-abc');

    expect(result).toEqual({
      type: 'NEW',
    });

    expect(repository.findByIdempotencyKey).toHaveBeenCalledWith('key-123');
  });

  it('should return REPLAY when the key exists with the same payload hash', async () => {
    const transaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-1',
      idempotencyKey: 'key-123',
      payloadHash: 'hash-abc',
      walletId: 'wallet-1',
      playerId: 'player-1',
      roundId: 'round-1',
      gameId: 'game-1',
      amount: Money.from('10.00', 'BRL'),
      kind: 'BET',
    });

    repository.findByIdempotencyKey.mockResolvedValue(transaction);

    const result = await service.resolve('key-123', 'hash-abc');

    expect(result).toEqual({
      type: 'REPLAY',
      transaction,
    });
  });

  it('should return CONFLICT when the key exists with a different payload hash', async () => {
    const transaction = WagerTransaction.create({
      providerId: 'provider-1',
      externalTransactionId: 'external-1',
      idempotencyKey: 'key-123',
      payloadHash: 'hash-original',
      walletId: 'wallet-1',
      playerId: 'player-1',
      roundId: 'round-1',
      gameId: 'game-1',
      amount: Money.from('10.00', 'BRL'),
      kind: 'BET',
    });

    repository.findByIdempotencyKey.mockResolvedValue(transaction);

    const result = await service.resolve('key-123', 'hash-different');

    expect(result).toEqual({
      type: 'CONFLICT',
    });
  });
});