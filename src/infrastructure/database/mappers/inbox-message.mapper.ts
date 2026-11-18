import { InboxMessage } from '../../../domain/inbox/inbox-message';
import { InboxMessageEntity } from '../entities/inbox-message.entity';

export class InboxMessageMapper {
  static toDomain(entity: InboxMessageEntity): InboxMessage {
    return InboxMessage.restore(
      entity.messageId,
      entity.consumerName,
      entity.payloadHash,
      entity.receivedAt,
      entity.processedAt,
    );
  }

  static toEntity(message: InboxMessage): InboxMessageEntity {
    const entity = new InboxMessageEntity();

    entity.messageId = message.id;
    entity.consumerName = message.consumer;
    entity.payloadHash = message.hash;
    entity.receivedAt = message.receivedDate;
    entity.processedAt = message.processedDate;

    return entity;
  }
}