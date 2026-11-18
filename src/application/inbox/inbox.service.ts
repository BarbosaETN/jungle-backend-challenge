import { InboxMessage } from '../../domain/inbox/inbox-message';
import { InboxMessageRepository } from '../../domain/inbox/inbox-message.repository';

export type InboxProcessResult = 'NEW' | 'DUPLICATE';

export class InboxService {
  constructor(
    private readonly inboxRepository: InboxMessageRepository,
  ) {}

  async process(
    messageId: string,
    consumerName: string,
    payloadHash: string,
  ): Promise<InboxProcessResult> {
    const existing = await this.inboxRepository.findById(
      messageId,
      consumerName,
    );

    if (existing) {
      return 'DUPLICATE';
    }

    const message = InboxMessage.create(
      messageId,
      consumerName,
      payloadHash,
    );

    await this.inboxRepository.save(message);

    return 'NEW';
  }
}