import { Inject } from '@nestjs/common';

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
    const payloadHash = generatePayloadHash(message.body);

    const result = await this.inboxService.process(
      message.messageId,
      this.consumerName,
      payloadHash,
    );

    if (result === 'NEW') {
      await this.messageHandler.handle({
        messageId: message.messageId,
        body: message.body,
      });

      await this.inboxService.markAsProcessed(
        message.messageId,
        this.consumerName,
      );
    }

    await this.messageConsumer.delete(this.queueUrl, message.receiptHandle);
  }
}
