import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';

import {
  MessageConsumer,
  ReceivedMessage,
} from '../../../application/messaging/message-consumer';

import { MessagePublisher } from '../../../application/messaging/message-publisher';

export class SqsClient implements MessagePublisher, MessageConsumer {
  private readonly client: SQSClient;

  constructor() {
    this.client = new SQSClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      endpoint: process.env.AWS_SQS_ENDPOINT ?? 'http://localhost:4566',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
      },
    });
  }

  async publish(queueUrl: string, message: string): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: message,
      }),
    );
  }

  async receive(
    queueUrl: string,
    maxMessages: number,
  ): Promise<ReceivedMessage[]> {
    console.log('SQS RECEIVE:', {
      queueUrl,
      maxMessages,
    });

    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 10,
      }),
    );

    return (response.Messages ?? [])
      .filter(
        (
          message,
        ): message is typeof message & {
          MessageId: string;
          ReceiptHandle: string;
        } => Boolean(message.MessageId && message.ReceiptHandle),
      )
      .map((message) => ({
        messageId: message.MessageId,
        receiptHandle: message.ReceiptHandle,
        body: message.Body ?? '',
      }));
  }

  async delete(queueUrl: string, receiptHandle: string): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }
}
