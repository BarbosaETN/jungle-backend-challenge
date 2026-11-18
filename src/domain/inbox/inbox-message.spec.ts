import { InboxMessage } from './inbox-message';
import { InboxMessageError } from './inbox-message.errors';

describe('InboxMessage', () => {
  it('should create an unprocessed message', () => {
    const message = InboxMessage.create(
      'message-1',
      'wallet-consumer',
      'a'.repeat(64),
    );

    expect(message.id).toBe('message-1');
    expect(message.consumer).toBe('wallet-consumer');
    expect(message.hash).toBe('a'.repeat(64));
    expect(message.isProcessed).toBe(false);
    expect(message.processedDate).toBeUndefined();
    expect(message.receivedDate).toBeInstanceOf(Date);
  });

  it('should mark a message as processed', () => {
    const message = InboxMessage.create(
      'message-2',
      'wallet-consumer',
      'b'.repeat(64),
    );

    message.markAsProcessed();

    expect(message.isProcessed).toBe(true);
    expect(message.processedDate).toBeInstanceOf(Date);
  });

  it('should reject processing the same message twice', () => {
    const message = InboxMessage.create(
      'message-3',
      'wallet-consumer',
      'c'.repeat(64),
    );

    message.markAsProcessed();

    expect(() => message.markAsProcessed()).toThrow(InboxMessageError);
    expect(() => message.markAsProcessed()).toThrow(
      'Inbox message has already been processed',
    );
  });

  it('should restore a processed message', () => {
    const receivedAt = new Date('2026-01-01T10:00:00.000Z');
    const processedAt = new Date('2026-01-01T10:01:00.000Z');

    const message = InboxMessage.restore(
      'message-4',
      'wallet-consumer',
      'd'.repeat(64),
      receivedAt,
      processedAt,
    );

    expect(message.id).toBe('message-4');
    expect(message.receivedDate).toBe(receivedAt);
    expect(message.processedDate).toBe(processedAt);
    expect(message.isProcessed).toBe(true);
  });

  it('should reject an empty message id', () => {
    expect(() =>
      InboxMessage.create(
        '',
        'wallet-consumer',
        'e'.repeat(64),
      ),
    ).toThrow('Inbox messageId cannot be empty');
  });

  it('should reject an empty consumer name', () => {
    expect(() =>
      InboxMessage.create(
        'message-5',
        '',
        'f'.repeat(64),
      ),
    ).toThrow('Inbox consumerName cannot be empty');
  });

  it('should reject an empty payload hash', () => {
    expect(() =>
      InboxMessage.create(
        'message-6',
        'wallet-consumer',
        '',
      ),
    ).toThrow('Inbox payloadHash cannot be empty');
  });
});
