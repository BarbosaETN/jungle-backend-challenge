import { Module } from '@nestjs/common';

import { MESSAGE_PUBLISHER } from '../../application/messaging/message-publisher.token';
import { SqsClient } from './sqs/sqs.client';

@Module({
  providers: [
    {
      provide: MESSAGE_PUBLISHER,
      useClass: SqsClient,
    },
  ],
  exports: [MESSAGE_PUBLISHER],
})
export class MessagingModule {}