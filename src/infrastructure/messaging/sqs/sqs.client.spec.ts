import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';

import { SqsClient } from './sqs.client';

describe('SqsClient', () => {
  it('should publish a message to SQS', async () => {
    const sendMock = jest
      .spyOn(SQSClient.prototype, 'send')
      .mockResolvedValue({} as never);

    const client = new SqsClient();

    await client.publish(
      'http://localhost:4566/queue',
      '{"type":"TEST_EVENT"}',
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(expect.any(SendMessageCommand));

    sendMock.mockRestore();
  });

  it('should receive messages from SQS', async () => {
    const sendMock = jest.spyOn(SQSClient.prototype, 'send').mockResolvedValue({
      Messages: [
        {
          MessageId: 'message-1',
          ReceiptHandle: 'receipt-1',
          Body: '{"eventType":"TEST_EVENT"}',
        },
      ],
    } as never);

    const client = new SqsClient();

    const messages = await client.receive('http://localhost:4566/queue', 10);

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(expect.any(ReceiveMessageCommand));

    expect(messages).toEqual([
      {
        messageId: 'message-1',
        receiptHandle: 'receipt-1',
        body: '{"eventType":"TEST_EVENT"}',
      },
    ]);

    sendMock.mockRestore();
  });

  it('should delete a message from SQS', async () => {
    const sendMock = jest
      .spyOn(SQSClient.prototype, 'send')
      .mockResolvedValue({} as never);

    const client = new SqsClient();

    await client.delete('http://localhost:4566/queue', 'receipt-1');

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(expect.any(DeleteMessageCommand));

    sendMock.mockRestore();
  });
});
