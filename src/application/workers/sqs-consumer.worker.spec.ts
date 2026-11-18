import { InboxService } from '../inbox/inbox.service';
import {
  MessageConsumer,
  ReceivedMessage,
} from '../messaging/message-consumer';
import { MessageHandler } from './message-handler';
import { SqsConsumerWorker } from './sqs-consumer.worker';

describe('SqsConsumerWorker', () => {
  it('should process a new message and delete it from SQS', async () => {
    const message: ReceivedMessage = {
      messageId: 'message-1',
      receiptHandle: 'receipt-1',
      body: '{"eventType":"TEST_EVENT"}',
    };

    const receive = jest.fn().mockResolvedValue([message]);
    const deleteMessage = jest.fn().mockResolvedValue(undefined);

    const messageConsumer = {
      receive,
      delete: deleteMessage,
    } as unknown as MessageConsumer;

    const process = jest.fn().mockResolvedValue('NEW');

    const inboxService = {
      process: jest.fn().mockResolvedValue('NEW'),
      markAsProcessed: jest.fn().mockResolvedValue(undefined),
    } as unknown as InboxService;

    const handle = jest.fn().mockResolvedValue(undefined);

    const messageHandler = {
      handle,
    } as unknown as MessageHandler;

    const worker = new SqsConsumerWorker(
      messageConsumer,
      inboxService,
      messageHandler,
      'http://queue.test',
      'wallet-consumer',
    );

    await worker.run();

    expect(inboxService.process).toHaveBeenCalledWith(
      'message-1',
      'wallet-consumer',
      'b354557f092d2eab72634f5339578853486488d41d54bd88a0462cd87df86752',
    );

    expect(inboxService.markAsProcessed).toHaveBeenCalledWith(
      'message-1',
      'wallet-consumer',
    );

    expect(messageHandler.handle).toHaveBeenCalledWith({
      messageId: 'message-1',
      body: '{"eventType":"TEST_EVENT"}',
    });

    expect(messageConsumer.delete).toHaveBeenCalledWith(
      'http://queue.test',
      'receipt-1',
    );
  });

  it('should not process a duplicate message', async () => {
    const message: ReceivedMessage = {
      messageId: 'message-1',
      receiptHandle: 'receipt-1',
      body: '{"eventType":"TEST_EVENT"}',
    };

    const messageConsumer = {
      receive: jest.fn().mockResolvedValue([message]),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as MessageConsumer;

    const inboxService = {
      process: jest.fn().mockResolvedValue('DUPLICATE'),
      markAsProcessed: jest.fn().mockResolvedValue(undefined),
    } as unknown as InboxService;

    const messageHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    } as unknown as MessageHandler;

    const worker = new SqsConsumerWorker(
      messageConsumer,
      inboxService,
      messageHandler,
      'http://queue.test',
      'wallet-consumer',
    );

    await worker.run();

    expect(messageHandler.handle).not.toHaveBeenCalled();

    expect(inboxService.markAsProcessed).not.toHaveBeenCalled();

    expect(messageConsumer.delete).toHaveBeenCalledWith(
      'http://queue.test',
      'receipt-1',
    );
  });

  it('should not delete the message when processing fails', async () => {
    const message: ReceivedMessage = {
      messageId: 'message-1',
      receiptHandle: 'receipt-1',
      body: '{"eventType":"TEST_EVENT"}',
    };

    const messageConsumer = {
      receive: jest.fn().mockResolvedValue([message]),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as MessageConsumer;

    const inboxService = {
      process: jest.fn().mockResolvedValue('NEW'),
      markAsProcessed: jest.fn().mockResolvedValue(undefined),
    } as unknown as InboxService;

    const messageHandler = {
      handle: jest.fn().mockRejectedValue(new Error('Processing failed')),
    } as unknown as MessageHandler;

    const worker = new SqsConsumerWorker(
      messageConsumer,
      inboxService,
      messageHandler,
      'http://queue.test',
      'wallet-consumer',
    );

    await expect(worker.run()).rejects.toThrow('Processing failed');

    expect(inboxService.markAsProcessed).not.toHaveBeenCalled();
    expect(messageConsumer.delete).not.toHaveBeenCalled();
  });

  it('should process the message successfully after a previous failure', async () => {
    const message: ReceivedMessage = {
      messageId: 'message-recovery',
      receiptHandle: 'receipt-recovery',
      body: '{"eventType":"TEST_EVENT"}',
    };

    const messageConsumer = {
      receive: jest
        .fn()
        .mockResolvedValueOnce([message])
        .mockResolvedValueOnce([message]),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as MessageConsumer;

    const inboxService = {
      process: jest.fn().mockResolvedValue('NEW'),
      markAsProcessed: jest.fn().mockResolvedValue(undefined),
    } as unknown as InboxService;

    const messageHandler = {
      handle: jest
        .fn()
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce(undefined),
    } as unknown as MessageHandler;

    const worker = new SqsConsumerWorker(
      messageConsumer,
      inboxService,
      messageHandler,
      'http://queue.test',
      'wallet-consumer',
    );

    // Primeira entrega: processamento falha.
    await expect(worker.run()).rejects.toThrow('Processing failed');

    expect(inboxService.markAsProcessed).not.toHaveBeenCalled();
    expect(messageConsumer.delete).not.toHaveBeenCalled();

    // Segunda entrega: processamento funciona.
    await worker.run();

    expect(messageHandler.handle).toHaveBeenCalledTimes(2);

    expect(inboxService.markAsProcessed).toHaveBeenCalledTimes(1);
    expect(inboxService.markAsProcessed).toHaveBeenCalledWith(
      'message-recovery',
      'wallet-consumer',
    );

    expect(messageConsumer.delete).toHaveBeenCalledTimes(1);
    expect(messageConsumer.delete).toHaveBeenCalledWith(
      'http://queue.test',
      'receipt-recovery',
    );
  });

  it('should process all received messages', async () => {
    const messages: ReceivedMessage[] = [
      {
        messageId: 'message-1',
        receiptHandle: 'receipt-1',
        body: '{"eventType":"EVENT_1"}',
      },
      {
        messageId: 'message-2',
        receiptHandle: 'receipt-2',
        body: '{"eventType":"EVENT_2"}',
      },
      {
        messageId: 'message-3',
        receiptHandle: 'receipt-3',
        body: '{"eventType":"EVENT_3"}',
      },
    ];

    const messageConsumer = {
      receive: jest.fn().mockResolvedValue(messages),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as MessageConsumer;

    const inboxService = {
      process: jest.fn().mockResolvedValue('NEW'),
      markAsProcessed: jest.fn().mockResolvedValue(undefined),
    } as unknown as InboxService;

    const messageHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    } as unknown as MessageHandler;

    const worker = new SqsConsumerWorker(
      messageConsumer,
      inboxService,
      messageHandler,
      'http://queue.test',
      'wallet-consumer',
    );

    await worker.run(3);

    expect(messageConsumer.receive).toHaveBeenCalledWith(
      'http://queue.test',
      3,
    );

    expect(messageHandler.handle).toHaveBeenCalledTimes(3);

    expect(messageConsumer.delete).toHaveBeenCalledTimes(3);

    expect(inboxService.markAsProcessed).toHaveBeenCalledTimes(3);

    expect(messageConsumer.delete).toHaveBeenNthCalledWith(
      1,
      'http://queue.test',
      'receipt-1',
    );

    expect(messageConsumer.delete).toHaveBeenNthCalledWith(
      2,
      'http://queue.test',
      'receipt-2',
    );

    expect(messageConsumer.delete).toHaveBeenNthCalledWith(
      3,
      'http://queue.test',
      'receipt-3',
    );
  });
});
