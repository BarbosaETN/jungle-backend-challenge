import { OutboxMessage } from '../../../domain/outbox/outbox-message';
import { OutboxMessageEntity } from '../entities/outbox-message.entity';

export class OutboxMessageMapper {
  static toDomain(entity: OutboxMessageEntity): OutboxMessage {
    return OutboxMessage.restore(
      entity.id,
      entity.aggregateId,
      entity.eventType,
      entity.payload,
      entity.occurredAt,
      entity.attempts,
      entity.nextAttemptAt,
      entity.publishedAt,
    );
  }

  static toEntity(message: OutboxMessage): OutboxMessageEntity {
    const entity = new OutboxMessageEntity();

    entity.id = message.messageId;
    entity.aggregateId = message.aggregate;
    entity.eventType = message.type;
    entity.payload = message.data;
    entity.occurredAt = message.occurredDate;
    entity.attempts = message.attemptCount;
    entity.nextAttemptAt = message.nextAttemptDate;
    entity.publishedAt = message.publishedDate;

    return entity;
  }
}