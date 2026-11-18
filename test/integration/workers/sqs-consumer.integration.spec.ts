import { Test } from '@nestjs/testing';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  SQSClient,
  SendMessageCommand,
  PurgeQueueCommand,
} from '@aws-sdk/client-sqs';

import { AppModule } from '../../../src/app.module';
import { SqsConsumerWorker } from '../../../src/application/workers/sqs-consumer.worker';
import { InboxMessageEntity } from '../../../src/infrastructure/database/entities/inbox-message.entity';
import { generatePayloadHash } from '../../../src/application/idempotency/payload-hash';

describe('SqsConsumerWorker integration', () => {
  let worker: SqsConsumerWorker;
  let em: EntityManager;
  let sqsClient: SQSClient;

  const queueUrl = process.env.AWS_SQS_QUEUE_URL!;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    worker = moduleRef.get(SqsConsumerWorker);
    em = moduleRef.get(EntityManager).fork();

    sqsClient = new SQSClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      endpoint: process.env.AWS_SQS_ENDPOINT ?? 'http://localhost:4566',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
      },
    });
  });

  afterAll(async () => {
    sqsClient.destroy();
  });

  it('should consume a real SQS message and persist it in the Inbox', async () => {
    const messageId = `integration-${Date.now()}`;

    const body = JSON.stringify({
      messageId,
      eventType: 'TEST_EVENT',
    });

    await sqsClient.send(
      new PurgeQueueCommand({
        QueueUrl: queueUrl,
      }),
    );

    const response = await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: body,
      }),
    );

    expect(response.MessageId).toBeDefined();

    await worker.run(1);

    const inboxMessage = await em.findOne(InboxMessageEntity, {
      messageId: response.MessageId,
      consumerName: 'wallet-consumer',
    });

    expect(inboxMessage).not.toBeNull();
    expect(inboxMessage?.payloadHash).toBe(generatePayloadHash(body));
    expect(inboxMessage?.processedAt).not.toBeNull();
  });
});