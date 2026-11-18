import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SQS_QUEUE_URL } from '../../application/messaging/sqs-queue-url.token';
import { EntityManager } from '@mikro-orm/postgresql';
import { OutboxService } from '../../application/outbox/outbox.service';
import { OutboxPublisherWorker } from '../../application/workers/outbox-publisher.worker';
import { MessagingModule } from '../messaging/messaging.module';
import { OutboxMessageEntity } from '../database/entities/outbox-message.entity';
import { MikroOrmOutboxMessageRepository } from '../database/repositories/mikro-orm-outbox-message.repository';
import { InboxService } from '../../application/inbox/inbox.service';
import { InboxMessageEntity } from '../database/entities/inbox-message.entity';
import { MikroOrmInboxMessageRepository } from '../database/repositories/mikro-orm-inbox-message.repository';
import { SQS_CONSUMER_NAME } from '../../application/messaging/sqs-consumer-name.token';
import { LoggingMessageHandler } from './logging-message-handler';
import { SqsConsumerWorker } from '../../application/workers/sqs-consumer.worker';

@Module({
  imports: [
    MessagingModule,
    MikroOrmModule.forFeature([OutboxMessageEntity, InboxMessageEntity]),
  ],
  providers: [
    {
      provide: SQS_QUEUE_URL,
      useValue: process.env.AWS_SQS_QUEUE_URL,
    },

    {
      provide: SQS_CONSUMER_NAME,
      useValue: 'wallet-consumer',
    },

    LoggingMessageHandler,

    {
      provide: 'MESSAGE_HANDLER',
      useExisting: LoggingMessageHandler,
    },

    {
      provide: MikroOrmInboxMessageRepository,
      useFactory: (em: EntityManager) =>
        new MikroOrmInboxMessageRepository(em.fork()),
      inject: [EntityManager],
    },
    {
      provide: InboxService,
      useFactory: (repository: MikroOrmInboxMessageRepository) =>
        new InboxService(repository),
      inject: [MikroOrmInboxMessageRepository],
    },
    {
      provide: MikroOrmOutboxMessageRepository,
      useFactory: (em: EntityManager) =>
        new MikroOrmOutboxMessageRepository(em.fork()),
      inject: [EntityManager],
    },
    {
      provide: OutboxService,
      useFactory: (repository: MikroOrmOutboxMessageRepository) =>
        new OutboxService(repository),
      inject: [MikroOrmOutboxMessageRepository],
    },
    OutboxPublisherWorker,
    SqsConsumerWorker,
  ],
  exports: [OutboxPublisherWorker],
})
export class WorkersModule {}
