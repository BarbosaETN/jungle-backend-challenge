import { OutboxMessage } from '../../domain/outbox/outbox-message';
import { OutboxMessageRepository } from '../../domain/outbox/outbox-message.repository';

export class OutboxService {
  constructor(private readonly outboxRepository: OutboxMessageRepository) {}

  async createMessage(
    id: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const message = OutboxMessage.create(id, aggregateId, eventType, payload);

    await this.outboxRepository.save(message);
  }

  async findPending(limit: number): Promise<OutboxMessage[]> {
    return this.outboxRepository.findPending(limit);
  }

  async markAsPublished(id: string): Promise<void> {
    const message = await this.outboxRepository.findById(id);

    if (!message) {
      throw new Error(`Outbox message not found: ${id}`);
    }

    message.markAsPublished();

    await this.outboxRepository.save(message);
  }

  async registerAttempt(id: string, nextAttemptAt?: Date): Promise<void> {
    const message = await this.outboxRepository.findById(id);

    if (!message) {
      throw new Error(`Outbox message not found: ${id}`);
    }

    message.registerAttempt(nextAttemptAt);

    await this.outboxRepository.save(message);
  }
}
