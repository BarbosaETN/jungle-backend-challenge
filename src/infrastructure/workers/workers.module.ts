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
import { MESSAGE_PUBLISHER } from '../../application/messaging/message-publisher.token';
import { MessagePublisher } from '../../application/messaging/message-publisher';
import type {
  MessageConsumer,
  ReceivedMessage,
} from '../../application/messaging/message-consumer';
import type { MessageHandler } from '../../application/workers/message-handler';

import { MESSAGE_CONSUMER } from '../../application/messaging/message-consumer.token';
import { CorrelationIdService } from '../observability/correlation-id.service';

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
    CorrelationIdService,
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
    {
      provide: OutboxPublisherWorker,
      useFactory: (
        outboxService: OutboxService,
        messagePublisher: MessagePublisher,
        queueUrl: string,
      ) => new OutboxPublisherWorker(outboxService, messagePublisher, queueUrl),
      inject: [OutboxService, MESSAGE_PUBLISHER, SQS_QUEUE_URL],
    },
    {
      provide: SqsConsumerWorker,
      useFactory: (
        messageConsumer: MessageConsumer,
        inboxService: InboxService,
        messageHandler: MessageHandler,
        queueUrl: string,
        consumerName: string,
        correlationIdService: CorrelationIdService,
      ) =>
        new SqsConsumerWorker(
          messageConsumer,
          inboxService,
          messageHandler,
          queueUrl,
          consumerName,
          correlationIdService,
        ),
      inject: [
        MESSAGE_CONSUMER,
        InboxService,
        'MESSAGE_HANDLER',
        SQS_QUEUE_URL,
        SQS_CONSUMER_NAME,
        CorrelationIdService,
      ],
    },
  ],
  exports: [OutboxPublisherWorker],
})
export class WorkersModule {}
