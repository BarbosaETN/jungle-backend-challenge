import { OutboxMessage } from '../../../src/domain/outbox/outbox-message';
import { OutboxMessageRepository } from '../../../src/domain/outbox/outbox-message.repository';
import { OutboxService } from '../../../src/application/outbox/outbox.service';

describe('OutboxService', () => {
  let repository: jest.Mocked<OutboxMessageRepository>;
  let service: OutboxService;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findPending: jest.fn(),
      save: jest.fn(),
    };

    service = new OutboxService(repository);
  });

  it('should create and save a message', async () => {
    await service.createMessage(
      'message-1',
      '00000000-0000-0000-0000-000000000001',
      'WALLET_UPDATED',
      {
        walletId: 'wallet-1',
      },
    );

    expect(repository.save).toHaveBeenCalledTimes(1);

    const savedMessage = repository.save.mock.calls[0][0];

    expect(savedMessage.messageId).toBe('message-1');
    expect(savedMessage.aggregate).toBe(
      '00000000-0000-0000-0000-000000000001',
    );
    expect(savedMessage.type).toBe('WALLET_UPDATED');
    expect(savedMessage.data).toEqual({
      walletId: 'wallet-1',
    });
  });

  it('should mark an existing message as published', async () => {
    const message = OutboxMessage.create(
      'message-1',
      '00000000-0000-0000-0000-000000000001',
      'WALLET_UPDATED',
      {},
    );

    repository.findById.mockResolvedValue(message);

    await service.markAsPublished('message-1');

    expect(repository.findById).toHaveBeenCalledWith('message-1');
    expect(repository.save).toHaveBeenCalledWith(message);
    expect(message.isPublished).toBe(true);
  });

  it('should register an attempt for an existing message', async () => {
    const message = OutboxMessage.create(
      'message-1',
      '00000000-0000-0000-0000-000000000001',
      'WALLET_UPDATED',
      {},
    );

    repository.findById.mockResolvedValue(message);

    const nextAttemptAt = new Date(Date.now() + 60_000);

    await service.registerAttempt('message-1', nextAttemptAt);

    expect(repository.findById).toHaveBeenCalledWith('message-1');
    expect(repository.save).toHaveBeenCalledWith(message);
    expect(message.attemptCount).toBe(1);
    expect(message.nextAttemptDate).toEqual(nextAttemptAt);
  });

  it('should throw when marking a nonexistent message as published', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.markAsPublished('message-1'),
    ).rejects.toThrow('Outbox message not found: message-1');

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should throw when registering an attempt for a nonexistent message', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.registerAttempt('message-1'),
    ).rejects.toThrow('Outbox message not found: message-1');

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should propagate the domain error when publishing an already published message', async () => {
    const message = OutboxMessage.create(
      'message-1',
      '00000000-0000-0000-0000-000000000001',
      'WALLET_UPDATED',
      {},
    );

    message.markAsPublished();

    repository.findById.mockResolvedValue(message);

    await expect(
      service.markAsPublished('message-1'),
    ).rejects.toThrow('Message is already published');

    expect(repository.save).not.toHaveBeenCalled();
  });
});
