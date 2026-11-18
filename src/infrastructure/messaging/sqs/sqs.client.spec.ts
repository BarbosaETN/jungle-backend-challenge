import {
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
    expect(sendMock).toHaveBeenCalledWith(
      expect.any(SendMessageCommand),
    );

    sendMock.mockRestore();
  });
});