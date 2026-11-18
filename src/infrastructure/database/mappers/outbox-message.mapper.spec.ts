import { OutboxMessage } from '../../../domain/outbox/outbox-message';
import { OutboxMessageMapper } from './outbox-message.mapper';
import { OutboxMessageEntity } from '../entities/outbox-message.entity';

describe('OutboxMessageMapper', () => {
  const payload = {
    walletId: 'wallet-1',
    amount: '30.00',
    currency: 'BRL',
  };

  it('should map domain to entity', () => {
    const message = OutboxMessage.create(
      'event-1',
      'wallet-1',
      'WALLET_DEBITED',
      payload,
    );

    const entity = OutboxMessageMapper.toEntity(message);

    expect(entity.id).toBe('event-1');
    expect(entity.aggregateId).toBe('wallet-1');
    expect(entity.eventType).toBe('WALLET_DEBITED');
    expect(entity.payload).toEqual(payload);
    expect(entity.attempts).toBe(0);
    expect(entity.publishedAt).toBeUndefined();
  });

  it('should map entity to domain', () => {
    const entity = new OutboxMessageEntity();

    entity.id = 'event-1';
    entity.aggregateId = 'wallet-1';
    entity.eventType = 'WALLET_DEBITED';
    entity.payload = payload;
    entity.occurredAt = new Date(
      '2026-11-18T02:00:00.000Z',
    );
    entity.attempts = 2;
    entity.nextAttemptAt = new Date(
      '2026-11-18T02:05:00.000Z',
    );
    entity.publishedAt = new Date(
      '2026-11-18T02:10:00.000Z',
    );

    const message = OutboxMessageMapper.toDomain(entity);

    expect(message.messageId).toBe('event-1');
    expect(message.aggregate).toBe('wallet-1');
    expect(message.type).toBe('WALLET_DEBITED');
    expect(message.data).toEqual(payload);
    expect(message.attemptCount).toBe(2);
    expect(message.nextAttemptDate).toEqual(
      entity.nextAttemptAt,
    );
    expect(message.publishedDate).toEqual(
      entity.publishedAt,
    );
    expect(message.isPublished).toBe(true);
  });

  it('should preserve null dates as undefined in the domain', () => {
    const entity = new OutboxMessageEntity();

    entity.id = 'event-1';
    entity.aggregateId = 'wallet-1';
    entity.eventType = 'WALLET_DEBITED';
    entity.payload = payload;
    entity.occurredAt = new Date();
    entity.attempts = 0;
    entity.nextAttemptAt = undefined;
    entity.publishedAt = undefined;

    const message = OutboxMessageMapper.toDomain(entity);

    expect(message.nextAttemptDate).toBeUndefined();
    expect(message.publishedDate).toBeUndefined();
    expect(message.isPublished).toBe(false);
  });
});
