import { Module } from '@nestjs/common';

import { MESSAGE_CONSUMER } from '../../application/messaging/message-consumer.token';
import { MESSAGE_PUBLISHER } from '../../application/messaging/message-publisher.token';
import { SqsClient } from './sqs/sqs.client';

@Module({
  providers: [
    SqsClient,
    {
      provide: MESSAGE_PUBLISHER,
      useExisting: SqsClient,
    },
    {
      provide: MESSAGE_CONSUMER,
      useExisting: SqsClient,
    },
  ],
  exports: [
    MESSAGE_PUBLISHER,
    MESSAGE_CONSUMER,
  ],
})
export class MessagingModule {}