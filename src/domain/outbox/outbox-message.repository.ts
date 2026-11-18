import { OutboxMessage } from './outbox-message';

export interface OutboxMessageRepository {
  findById(id: string): Promise<OutboxMessage | null>;

  findPending(limit: number): Promise<OutboxMessage[]>;

  save(message: OutboxMessage): Promise<void>;
}