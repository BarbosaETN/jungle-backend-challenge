import { Inject, Optional } from '@nestjs/common';

import { MESSAGE_CONSUMER } from '../messaging/message-consumer.token';
import { InboxService } from '../inbox/inbox.service';
import { generatePayloadHash } from '../idempotency/payload-hash';
import type {
  MessageConsumer,
  ReceivedMessage,
} from '../messaging/message-consumer';
import type { MessageHandler } from './message-handler';
import { SQS_QUEUE_URL } from '../messaging/sqs-queue-url.token';
import { SQS_CONSUMER_NAME } from '../messaging/sqs-consumer-name.token';
import { CorrelationIdService } from '../../infrastructure/observability/correlation-id.service';
import { LoggerService } from '../../infrastructure/observability/logger.service';
import { LOG_EVENTS } from '../../infrastructure/observability/log-events';

export class SqsConsumerWorker {
  constructor(
    @Inject(MESSAGE_CONSUMER)
    private readonly messageConsumer: MessageConsumer,

    private readonly inboxService: InboxService,

    @Inject('MESSAGE_HANDLER')
    private readonly messageHandler: MessageHandler,

    @Inject(SQS_QUEUE_URL)
    private readonly queueUrl: string,

    @Inject(SQS_CONSUMER_NAME)
    private readonly consumerName: string,

    private readonly correlationIdService: CorrelationIdService,

    @Optional()
    private readonly logger?: LoggerService,
  ) {}

  async run(maxMessages = 10): Promise<void> {
    const messages = await this.messageConsumer.receive(
      this.queueUrl,
      maxMessages,
    );

    for (const message of messages) {
      await this.processMessage(message);
    }
  }

  private async processMessage(message: ReceivedMessage): Promise<void> {
    this.logger?.info(LOG_EVENTS.SQS_MESSAGE_RECEIVED, {
      messageId: message.messageId,
      consumerName: this.consumerName,
    });

    const payloadHash = generatePayloadHash(message.body);

    const result = await this.inboxService.process(
      message.messageId,
      this.consumerName,
      payloadHash,
    );

    if (result === 'NEW') {
      const payload = JSON.parse(message.body) as {
        correlationId?: string;
      };

      const correlationId = payload.correlationId ?? message.messageId;

      try {
        await this.correlationIdService.run(correlationId, async () => {
          await this.messageHandler.handle({
            messageId: message.messageId,
            body: message.body,
          });
        });

        await this.inboxService.markAsProcessed(
          message.messageId,
          this.consumerName,
        );

        this.logger?.info(LOG_EVENTS.SQS_MESSAGE_PROCESSED, {
          messageId: message.messageId,
          consumerName: this.consumerName,
        });
      } catch (error) {
        this.logger?.error(
          LOG_EVENTS.SQS_MESSAGE_FAILED,
          {
            messageId: message.messageId,
            consumerName: this.consumerName,
          },
          error,
        );

        throw error;
      }
    }

    await this.messageConsumer.delete(this.queueUrl, message.receiptHandle);
  }
}
