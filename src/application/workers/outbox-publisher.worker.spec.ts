import { OutboxPublisherWorker } from './outbox-publisher.worker';
import { OutboxMessage } from '../../domain/outbox/outbox-message';
import { OutboxService } from '../outbox/outbox.service';
import { MessagePublisher } from '../messaging/message-publisher';

describe('OutboxPublisherWorker', () => {
  it('should publish pending messages and mark them as published', async () => {
    const message = OutboxMessage.create(
      'message-1',
      'aggregate-1',
      'TEST_EVENT',
      {
        amount: '10.00',
      },
    );

    const findPending = jest.fn().mockResolvedValue([message]);
    const markAsPublished = jest.fn().mockResolvedValue(undefined);

    const outboxService = {
      findPending,
      markAsPublished,
      registerAttempt: jest.fn(),
    } as unknown as OutboxService;

    const publish = jest.fn().mockResolvedValue(undefined);

    const messagePublisher = {
      publish,
    } as unknown as MessagePublisher;

    const worker = new OutboxPublisherWorker(
      outboxService,
      messagePublisher,
      'http://queue.test',
    );

    await worker.run();

    expect(findPending).toHaveBeenCalledWith(10);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      'http://queue.test',
      expect.stringContaining('"eventType":"TEST_EVENT"'),
    );

    expect(markAsPublished).toHaveBeenCalledWith('message-1');
  });

  it('should register an attempt when publishing fails', async () => {
    const message = OutboxMessage.create(
      'message-2',
      'aggregate-2',
      'TEST_EVENT',
      {
        amount: '20.00',
      },
    );

    const findPending = jest.fn().mockResolvedValue([message]);
    const markAsPublished = jest.fn().mockResolvedValue(undefined);
    const registerAttempt = jest.fn().mockResolvedValue(undefined);

    const outboxService = {
      findPending,
      markAsPublished,
      registerAttempt,
    } as unknown as OutboxService;

    const publish = jest.fn().mockRejectedValue(new Error('SQS unavailable'));

    const messagePublisher = {
      publish,
    } as unknown as MessagePublisher;

    const worker = new OutboxPublisherWorker(
      outboxService,
      messagePublisher,
      'http://queue.test',
    );

    await worker.run();

    expect(publish).toHaveBeenCalledTimes(1);

    expect(markAsPublished).not.toHaveBeenCalled();

    expect(registerAttempt).toHaveBeenCalledTimes(1);
    expect(registerAttempt).toHaveBeenCalledWith('message-2', expect.any(Date));
  });

  it('should retry a failed publication and mark the message as published after recovery', async () => {
    const message = OutboxMessage.create(
      'message-recovery',
      'aggregate-recovery',
      'TEST_EVENT',
      {
        amount: '30.00',
      },
    );

    const findPending = jest
      .fn()
      .mockResolvedValueOnce([message])
      .mockResolvedValueOnce([message]);

    const markAsPublished = jest.fn().mockResolvedValue(undefined);
    const registerAttempt = jest.fn().mockResolvedValue(undefined);

    const outboxService = {
      findPending,
      markAsPublished,
      registerAttempt,
    } as unknown as OutboxService;

    const publish = jest
      .fn()
      .mockRejectedValueOnce(new Error('SQS unavailable'))
      .mockResolvedValueOnce(undefined);

    const messagePublisher = {
      publish,
    } as unknown as MessagePublisher;

    const worker = new OutboxPublisherWorker(
      outboxService,
      messagePublisher,
      'http://queue.test',
    );

    // Primeira tentativa: SQS está indisponível.
    await worker.run();

    expect(publish).toHaveBeenCalledTimes(1);
    expect(markAsPublished).not.toHaveBeenCalled();
    expect(registerAttempt).toHaveBeenCalledTimes(1);

    // Segunda tentativa: SQS voltou.
    await worker.run();

    expect(publish).toHaveBeenCalledTimes(2);
    expect(markAsPublished).toHaveBeenCalledTimes(1);
    expect(markAsPublished).toHaveBeenCalledWith('message-recovery');
  });

  it('should respect the processing limit', async () => {
    const messages = Array.from({ length: 3 }, (_, index) =>
      OutboxMessage.create(
        `message-${index}`,
        `aggregate-${index}`,
        'TEST_EVENT',
        {},
      ),
    );

    const findPending = jest.fn().mockResolvedValue(messages);

    const outboxService = {
      findPending,
      markAsPublished: jest.fn().mockResolvedValue(undefined),
      registerAttempt: jest.fn().mockResolvedValue(undefined),
    } as unknown as OutboxService;

    const publish = jest.fn().mockResolvedValue(undefined);

    const messagePublisher = {
      publish,
    } as unknown as MessagePublisher;

    const worker = new OutboxPublisherWorker(
      outboxService,
      messagePublisher,
      'http://queue.test',
    );

    await worker.run(3);

    expect(findPending).toHaveBeenCalledWith(3);
    expect(publish).toHaveBeenCalledTimes(3);
  });

  it('should repeatedly run while the worker is active', async () => {
    const outboxService = {
      findPending: jest.fn().mockResolvedValue([]),
      markAsPublished: jest.fn().mockResolvedValue(undefined),
      registerAttempt: jest.fn().mockResolvedValue(undefined),
    } as unknown as OutboxService;

    const messagePublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as MessagePublisher;

    const worker = new OutboxPublisherWorker(
      outboxService,
      messagePublisher,
      'http://queue.test',
    );

    const runMock = jest.spyOn(worker, 'run').mockImplementation(async () => {
      worker.stop();
    });

    await worker.start(1);

    expect(runMock).toHaveBeenCalledTimes(1);

    runMock.mockRestore();
  });

  it('should not start multiple loops', async () => {
    const outboxService = {
      findPending: jest.fn().mockResolvedValue([]),
      markAsPublished: jest.fn().mockResolvedValue(undefined),
      registerAttempt: jest.fn().mockResolvedValue(undefined),
    } as unknown as OutboxService;

    const messagePublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as MessagePublisher;

    const worker = new OutboxPublisherWorker(
      outboxService,
      messagePublisher,
      'http://queue.test',
    );

    let resolveRun!: () => void;

    const runFinished = new Promise<void>((resolve) => {
      resolveRun = resolve;
    });

    const runMock = jest.spyOn(worker, 'run').mockImplementation(async () => {
      await runFinished;
    });

    const firstStart = worker.start(1);

    await Promise.resolve();

    const secondStart = worker.start(1);

    expect(runMock).toHaveBeenCalledTimes(1);

    worker.stop();
    resolveRun();

    await Promise.all([firstStart, secondStart]);

    runMock.mockRestore();
  });
});
