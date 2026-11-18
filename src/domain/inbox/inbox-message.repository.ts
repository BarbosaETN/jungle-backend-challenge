import { InboxMessage } from './inbox-message';

export interface InboxMessageRepository {
  findById(
    messageId: string,
    consumerName: string,
  ): Promise<InboxMessage | null>;

  save(message: InboxMessage): Promise<void>;
}
