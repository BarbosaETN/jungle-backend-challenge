import { Test } from '@nestjs/testing';

import { MessagePublisher } from '../../../src/application/messaging/message-publisher';
import { MESSAGE_PUBLISHER } from '../../../src/application/messaging/message-publisher.token';
import { MessagingModule } from '../../../src/infrastructure/messaging/messaging.module';
import { SqsClient } from '../../../src/infrastructure/messaging/sqs/sqs.client';

describe('MessagingModule', () => {
  it('should resolve the MessagePublisher implementation', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MessagingModule],
    }).compile();

    const publisher = moduleRef.get<MessagePublisher>(
      MESSAGE_PUBLISHER,
    );

    expect(publisher).toBeInstanceOf(SqsClient);
  });
});