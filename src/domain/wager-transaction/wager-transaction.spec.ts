import { Money } from '../money/money';
import { WagerTransaction } from './wager-transaction';

describe('WagerTransaction', () => {
  const createValidInput = () => ({
    providerId: 'provider-1',
    externalTransactionId: 'external-123',
    idempotencyKey: 'idem-123',
    payloadHash: 'a'.repeat(64),
    walletId: 'wallet-123',
    playerId: 'player-123',
    roundId: 'round-123',
    gameId: 'game-123',
    amount: Money.from('100.00', 'BRL'),
    kind: 'BET' as const,
  });

  describe('create', () => {
    it('should create a valid wager transaction', () => {
      const transaction = WagerTransaction.create(createValidInput());

      expect(transaction.transactionId).toBeDefined();
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
      expect(transaction.currentStatus).toBe('PENDING');
    });

    it('should generate a unique transaction id', () => {
      const transaction1 = WagerTransaction.create(createValidInput());
      const transaction2 = WagerTransaction.create({
        ...createValidInput(),
        externalTransactionId: 'external-456',
        idempotencyKey: 'idem-456',
      });

      expect(transaction1.transactionId).toBeDefined();
      expect(transaction2.transactionId).toBeDefined();
      expect(transaction1.transactionId).not.toBe(transaction2.transactionId);
    });

    it('should reject an empty required field', () => {
      const input = createValidInput();
      input.providerId = '';

      expect(() => WagerTransaction.create(input)).toThrow(
        'WagerTransaction providerId cannot be empty',
      );
    });

    it('should reject an amount of zero', () => {
      const input = createValidInput();
      input.amount = Money.from('0.00', 'BRL');

      expect(() => WagerTransaction.create(input)).toThrow(
        'WagerTransaction amount must be greater than zero',
      );
    });

    it('should reject an invalid kind', () => {
      const input = createValidInput();

      expect(() =>
        WagerTransaction.create({
          ...input,
          kind: 'INVALID' as never,
        }),
      ).toThrow('Invalid WagerTransaction kind: INVALID');
    });
  });

  describe('restore', () => {
    it('should restore a valid wager transaction', () => {
      const createdAt = new Date('2026-11-17T12:00:00.000Z');
      const processedAt = new Date('2026-11-17T12:05:00.000Z');

      const transaction = WagerTransaction.restore({
        ...createValidInput(),
        id: 'transaction-123',
        status: 'PROCESSED',
        referenceExternalTransactionId: 'external-ref-123',
        referenceTransactionId: 'transaction-ref-123',
        failureCode: undefined,
        processedAt,
        createdAt,
      });

      expect(transaction.transactionId).toBe('transaction-123');
      expect(transaction.currentStatus).toBe('PROCESSED');
      expect(transaction.referenceExternalId).toBe('external-ref-123');
      expect(transaction.referenceId).toBe('transaction-ref-123');
      expect(transaction.processedDate).toBe(processedAt);
      expect(transaction.creationDate).toBe(createdAt);
    });

    it('should reject an empty id', () => {
      expect(() =>
        WagerTransaction.restore({
          ...createValidInput(),
          id: '',
          status: 'PENDING',
          createdAt: new Date(),
        }),
      ).toThrow('WagerTransaction id cannot be empty');
    });

    it('should reject an invalid status', () => {
      expect(() =>
        WagerTransaction.restore({
          ...createValidInput(),
          id: 'transaction-123',
          status: 'INVALID' as never,
          createdAt: new Date(),
        }),
      ).toThrow('Invalid WagerTransaction status: INVALID');
    });

    it('should preserve a failure code', () => {
      const transaction = WagerTransaction.restore({
        ...createValidInput(),
        id: 'transaction-123',
        status: 'FAILED',
        failureCode: 'INSUFFICIENT_FUNDS',
        createdAt: new Date(),
      });

      expect(transaction.errorCode).toBe('INSUFFICIENT_FUNDS');
    });
  });
});
