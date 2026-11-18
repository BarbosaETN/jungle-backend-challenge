import { OutboxService } from '../outbox/outbox.service';
import type { MessagePublisher } from '../messaging/message-publisher';
import { Inject } from '@nestjs/common';
import { SQS_QUEUE_URL } from '../messaging/sqs-queue-url.token';

import { MESSAGE_PUBLISHER } from '../messaging/message-publisher.token';

export class OutboxPublisherWorker {
  private running = false;

  constructor(
    private readonly outboxService: OutboxService,

    @Inject(MESSAGE_PUBLISHER)
    private readonly messagePublisher: MessagePublisher,

    @Inject(SQS_QUEUE_URL)
    private readonly queueUrl: string,
  ) {}

  async run(limit = 10): Promise<void> {
    const messages = await this.outboxService.findPending(limit);

    for (const message of messages) {
      try {
        await this.messagePublisher.publish(
          this.queueUrl,
          JSON.stringify({
            id: message.messageId,
            aggregateId: message.aggregate,
            eventType: message.type,
            payload: message.data,
            occurredAt: message.occurredDate,
          }),
        );

        await this.outboxService.markAsPublished(message.messageId);
      } catch {
        await this.outboxService.registerAttempt(
          message.messageId,
          new Date(Date.now() + 5_000),
        );
      }
    }
  }

  async start(intervalMs = 5_000, limit = 10): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    while (this.running) {
      await this.run(limit);

      if (!this.running) {
        break;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  }

  stop(): void {
    this.running = false;
  }
}
