import {
  Check,
  Entity,
  Index,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'outbox_messages' })
@Check({
  name: 'outbox_messages_attempts_non_negative',
  expression: 'attempts >= 0',
})
@Index({
  name: 'outbox_messages_pending_idx',
  properties: ['nextAttemptAt', 'occurredAt'],
  options: {
    where: 'published_at IS NULL',
  },
})
export class OutboxMessageEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  aggregateId!: string;

  @Property({ type: 'string', length: 100 })
  eventType!: string;

  @Property({ type: 'json' })
  payload!: Record<string, unknown>;

  @Property({ type: 'timestamptz', onCreate: () => new Date() })
  occurredAt!: Date;

  @Property({ type: 'integer', default: 0 })
  attempts!: number;

  @Property({ type: 'timestamptz', nullable: true })
  nextAttemptAt?: Date;

  @Property({ type: 'timestamptz', nullable: true })
  publishedAt?: Date;
}