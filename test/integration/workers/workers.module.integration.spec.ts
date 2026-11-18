import { Test } from '@nestjs/testing';

import { AppModule } from '../../../src/app.module';
import { OutboxPublisherWorker } from '../../../src/application/workers/outbox-publisher.worker';
import { SqsConsumerWorker } from '../../../src/application/workers/sqs-consumer.worker';

describe('WorkersModule', () => {
  it('should resolve the OutboxPublisherWorker', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const worker = moduleRef.get(OutboxPublisherWorker);

    expect(worker).toBeInstanceOf(OutboxPublisherWorker);
  });

  it('should resolve the SqsConsumerWorker', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const worker = moduleRef.get(SqsConsumerWorker);

    expect(worker).toBeInstanceOf(SqsConsumerWorker);
  });
});