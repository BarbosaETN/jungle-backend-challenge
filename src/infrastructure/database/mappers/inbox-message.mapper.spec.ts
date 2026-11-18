import { InboxMessage } from '../../../domain/inbox/inbox-message';
import { InboxMessageMapper } from './inbox-message.mapper';

describe('InboxMessageMapper', () => {
  it('should map entity to domain', () => {
    const receivedAt = new Date('2026-11-18T00:00:00.000Z');
    const processedAt = new Date('2026-11-18T00:01:00.000Z');

    const entity = {
      messageId: 'message-1',
      consumerName: 'wallet-worker',
      payloadHash: 'a'.repeat(64),
      receivedAt,
      processedAt,
    } as any;

    const message = InboxMessageMapper.toDomain(entity);

    expect(message.id).toBe('message-1');
    expect(message.consumer).toBe('wallet-worker');
    expect(message.hash).toBe('a'.repeat(64));
    expect(message.receivedDate).toEqual(receivedAt);
    expect(message.processedDate).toEqual(processedAt);
    expect(message.isProcessed).toBe(true);
  });

  it('should map domain to entity', () => {
    const message = InboxMessage.create(
      'message-1',
      'wallet-worker',
      'a'.repeat(64),
    );

    const entity = InboxMessageMapper.toEntity(message);

    expect(entity.messageId).toBe('message-1');
    expect(entity.consumerName).toBe('wallet-worker');
    expect(entity.payloadHash).toBe('a'.repeat(64));
    expect(entity.receivedAt).toEqual(message.receivedDate);
    expect(entity.processedAt).toBeUndefined();
  });

  it('should preserve processed state when mapping domain to entity', () => {
    const message = InboxMessage.create(
      'message-1',
      'wallet-worker',
      'a'.repeat(64),
    );

    message.markAsProcessed();

    const entity = InboxMessageMapper.toEntity(message);

    expect(entity.processedAt).toEqual(message.processedDate);
  });
});
