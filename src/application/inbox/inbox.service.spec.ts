import { InboxMessage } from '../../domain/inbox/inbox-message';
import { InboxMessageRepository } from '../../domain/inbox/inbox-message.repository';
import { InboxService } from './inbox.service';

class FakeInboxMessageRepository implements InboxMessageRepository {
  private readonly messages = new Map<string, InboxMessage>();

  async findById(
    messageId: string,
    consumerName: string,
  ): Promise<InboxMessage | null> {
    return (
      this.messages.get(`${messageId}:${consumerName}`) ?? null
    );
  }

  async save(message: InboxMessage): Promise<void> {
    this.messages.set(
      `${message.id}:${message.consumer}`,
      message,
    );
  }
}

describe('InboxService', () => {
  let repository: FakeInboxMessageRepository;
  let service: InboxService;

  beforeEach(() => {
    repository = new FakeInboxMessageRepository();
    service = new InboxService(repository);
  });

  it('should register a new message', async () => {
    const result = await service.process(
      'message-1',
      'wallet-worker',
      'a'.repeat(64),
    );

    expect(result).toBe('NEW');

    const saved = await repository.findById(
      'message-1',
      'wallet-worker',
    );

    expect(saved).not.toBeNull();
    expect(saved?.id).toBe('message-1');
  });

  it('should return DUPLICATE when the message already exists', async () => {
    await service.process(
      'message-1',
      'wallet-worker',
      'a'.repeat(64),
    );

    const result = await service.process(
      'message-1',
      'wallet-worker',
      'a'.repeat(64),
    );

    expect(result).toBe('DUPLICATE');
  });

  it('should treat the same message id as different messages for different consumers', async () => {
    const walletResult = await service.process(
      'message-1',
      'wallet-worker',
      'a'.repeat(64),
    );

    const ledgerResult = await service.process(
      'message-1',
      'ledger-worker',
      'a'.repeat(64),
    );

    expect(walletResult).toBe('NEW');
    expect(ledgerResult).toBe('NEW');
  });
});