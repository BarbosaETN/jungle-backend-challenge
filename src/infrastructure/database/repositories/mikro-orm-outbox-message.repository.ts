import { EntityManager } from '@mikro-orm/postgresql';

import { OutboxMessage } from '../../../domain/outbox/outbox-message';
import { OutboxMessageRepository } from '../../../domain/outbox/outbox-message.repository';
import { OutboxMessageEntity } from '../entities/outbox-message.entity';
import { OutboxMessageMapper } from '../mappers/outbox-message.mapper';

export class MikroOrmOutboxMessageRepository implements OutboxMessageRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<OutboxMessage | null> {
    const entity = await this.em.findOne(OutboxMessageEntity, {
      id,
    });

    if (!entity) {
      return null;
    }

    return OutboxMessageMapper.toDomain(entity);
  }

  async findPending(limit: number): Promise<OutboxMessage[]> {
    const now = new Date();

    const entities = await this.em.find(
      OutboxMessageEntity,
      {
        publishedAt: null,
        $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
      },
      {
        orderBy: {
          nextAttemptAt: 'asc',
          occurredAt: 'asc',
        },
        limit,
      },
    );

    return entities.map((entity) => OutboxMessageMapper.toDomain(entity));
  }

  async save(message: OutboxMessage): Promise<void> {
    const existingEntity = await this.em.findOne(OutboxMessageEntity, {
      id: message.messageId,
    });

    if (!existingEntity) {
      const entity = OutboxMessageMapper.toEntity(message);

      this.em.persist(entity);
      await this.em.flush();

      return;
    }

    existingEntity.aggregateId = message.aggregate;
    existingEntity.eventType = message.type;
    existingEntity.payload = message.data;
    existingEntity.occurredAt = message.occurredDate;
    existingEntity.attempts = message.attemptCount;
    existingEntity.nextAttemptAt = message.nextAttemptDate;
    existingEntity.publishedAt = message.publishedDate;

    await this.em.flush();
  }
}
