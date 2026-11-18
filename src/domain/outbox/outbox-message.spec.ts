import {
  OutboxMessage,
  OutboxMessageError,
} from './outbox-message';

describe('OutboxMessage', () => {
  const payload = {
    walletId: 'wallet-1',
    amount: '30.00',
    currency: 'BRL',
  };

  it('should create a new outbox message', () => {
    const message = OutboxMessage.create(
      'event-1',
      'wallet-1',
      'WALLET_DEBITED',
      payload,
    );

    expect(message.messageId).toBe('event-1');
    expect(message.aggregate).toBe('wallet-1');
    expect(message.type).toBe('WALLET_DEBITED');
    expect(message.data).toEqual(payload);
    expect(message.attemptCount).toBe(0);
    expect(message.publishedDate).toBeUndefined();
    expect(message.isPublished).toBe(false);
  });

  it('should reject an empty id', () => {
    expect(() =>
      OutboxMessage.create(
        '',
        'wallet-1',
        'WALLET_DEBITED',
        payload,
      ),
    ).toThrow(OutboxMessageError);
  });

  it('should reject an empty aggregate id', () => {
    expect(() =>
      OutboxMessage.create(
        'event-1',
        '',
        'WALLET_DEBITED',
        payload,
      ),
    ).toThrow(OutboxMessageError);
  });

  it('should reject an empty event type', () => {
    expect(() =>
      OutboxMessage.create(
        'event-1',
        'wallet-1',
        '',
        payload,
      ),
    ).toThrow(OutboxMessageError);
  });

  it('should mark the message as published', () => {
    const message = OutboxMessage.create(
      'event-1',
      'wallet-1',
      'WALLET_DEBITED',
      payload,
    );

    message.markAsPublished();

    expect(message.isPublished).toBe(true);
    expect(message.publishedDate).toBeInstanceOf(Date);
  });

  it('should not allow publishing the same message twice', () => {
    const message = OutboxMessage.create(
      'event-1',
      'wallet-1',
      'WALLET_DEBITED',
      payload,
    );

    message.markAsPublished();

    expect(() => message.markAsPublished()).toThrow(
      OutboxMessageError,
    );
  });

  it('should register a publication attempt', () => {
    const message = OutboxMessage.create(
      'event-1',
      'wallet-1',
      'WALLET_DEBITED',
      payload,
    );

    const nextAttempt = new Date('2026-11-18T03:00:00.000Z');

    message.registerAttempt(nextAttempt);

    expect(message.attemptCount).toBe(1);
    expect(message.nextAttemptDate).toEqual(nextAttempt);
  });

  it('should register multiple publication attempts', () => {
    const message = OutboxMessage.create(
      'event-1',
      'wallet-1',
      'WALLET_DEBITED',
      payload,
    );

    message.registerAttempt();
    message.registerAttempt();
    message.registerAttempt();

    expect(message.attemptCount).toBe(3);
  });

  it('should restore a published message', () => {
    const occurredAt = new Date('2026-11-18T02:00:00.000Z');
    const publishedAt = new Date('2026-11-18T02:05:00.000Z');

    const message = OutboxMessage.restore(
      'event-1',
      'wallet-1',
      'WALLET_DEBITED',
      payload,
      occurredAt,
      2,
      null,
      publishedAt,
    );

    expect(message.messageId).toBe('event-1');
    expect(message.occurredDate).toEqual(occurredAt);
    expect(message.attemptCount).toBe(2);
    expect(message.publishedDate).toEqual(publishedAt);
    expect(message.isPublished).toBe(true);
  });

  it('should reject a negative attempt count', () => {
    expect(() =>
      OutboxMessage.restore(
        'event-1',
        'wallet-1',
        'WALLET_DEBITED',
        payload,
        new Date(),
        -1,
      ),
    ).toThrow(OutboxMessageError);
  });
});