import { EntityManager } from '@mikro-orm/postgresql';

import { InboxMessage } from '../../../domain/inbox/inbox-message';
import { InboxMessageRepository } from '../../../domain/inbox/inbox-message.repository';
import { InboxMessageEntity } from '../entities/inbox-message.entity';
import { InboxMessageMapper } from '../mappers/inbox-message.mapper';

export class MikroOrmInboxMessageRepository
  implements InboxMessageRepository
{
  constructor(private readonly em: EntityManager) {}

  async findById(
    messageId: string,
    consumerName: string,
  ): Promise<InboxMessage | null> {
    const entity = await this.em.findOne(InboxMessageEntity, {
      messageId,
      consumerName,
    });

    if (!entity) {
      return null;
    }

    return InboxMessageMapper.toDomain(entity);
  }

  async save(message: InboxMessage): Promise<void> {
    const existingEntity = await this.em.findOne(InboxMessageEntity, {
      messageId: message.id,
      consumerName: message.consumer,
    });

    if (!existingEntity) {
      const entity = InboxMessageMapper.toEntity(message);

      this.em.persist(entity);
      await this.em.flush();

      return;
    }

    existingEntity.payloadHash = message.hash;
    existingEntity.receivedAt = message.receivedDate;
    existingEntity.processedAt = message.processedDate;

    await this.em.flush();
  }
}