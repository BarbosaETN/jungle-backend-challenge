import { MikroORM } from '@mikro-orm/postgresql';
import { OutboxMessageEntity } from '../../../src/infrastructure/database/entities/outbox-message.entity';
import mikroOrmConfig from '../../../src/infrastructure/database/mikro-orm.config';
import { OutboxMessage } from '../../../src/domain/outbox/outbox-message';
import { MikroOrmOutboxMessageRepository } from '../../../src/infrastructure/database/repositories/mikro-orm-outbox-message.repository';

describe('MikroOrmOutboxMessageRepository', () => {
  let orm: MikroORM;
  let repository: MikroOrmOutboxMessageRepository;

  beforeAll(async () => {
    orm = await MikroORM.init(mikroOrmConfig);

    repository = new MikroOrmOutboxMessageRepository(orm.em.fork());
  });

  beforeEach(async () => {
    const em = orm.em.fork();

    await em.nativeDelete(OutboxMessageEntity, {});

    em.clear();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('should save and find a message by id', async () => {
    const message = OutboxMessage.create(
      crypto.randomUUID(),
      crypto.randomUUID(),
      'WAGER_TRANSACTION_PROCESSED',
      {
        transactionId: crypto.randomUUID(),
        amount: '100.00',
        currency: 'BRL',
      },
    );

    await repository.save(message);

    const found = await repository.findById(message.messageId);

    expect(found).not.toBeNull();
    expect(found?.messageId).toBe(message.messageId);
    expect(found?.aggregate).toBe(message.aggregate);
    expect(found?.type).toBe(message.type);
    expect(found?.data).toEqual(message.data);
    expect(found?.attemptCount).toBe(0);
    expect(found?.isPublished).toBe(false);
  });

  it('should return null when message does not exist', async () => {
    const found = await repository.findById(crypto.randomUUID());

    expect(found).toBeNull();
  });

  it('should return only unpublished messages', async () => {
    const pending = OutboxMessage.create(
      crypto.randomUUID(),
      crypto.randomUUID(),
      'WALLET_UPDATED',
      { walletId: crypto.randomUUID() },
    );

    const published = OutboxMessage.create(
      crypto.randomUUID(),
      crypto.randomUUID(),
      'WALLET_UPDATED',
      { walletId: crypto.randomUUID() },
    );

    published.markAsPublished();

    await repository.save(pending);
    await repository.save(published);

    const result = await repository.findPending(10);

    expect(result).toHaveLength(1);
    expect(result[0].messageId).toBe(pending.messageId);
  });

  it('should respect the limit', async () => {
    const messages = Array.from({ length: 3 }, () =>
      OutboxMessage.create(
        crypto.randomUUID(),
        crypto.randomUUID(),
        'WALLET_UPDATED',
        { walletId: crypto.randomUUID() },
      ),
    );

    for (const message of messages) {
      await repository.save(message);
    }

    const result = await repository.findPending(2);

    expect(result).toHaveLength(2);
  });

  it('should return pending messages ordered by nextAttemptAt and occurredAt', async () => {
    const first = OutboxMessage.create(
      crypto.randomUUID(),
      crypto.randomUUID(),
      'EVENT_FIRST',
      {},
    );

    const second = OutboxMessage.create(
      crypto.randomUUID(),
      crypto.randomUUID(),
      'EVENT_SECOND',
      {},
    );

    const third = OutboxMessage.create(
      crypto.randomUUID(),
      crypto.randomUUID(),
      'EVENT_THIRD',
      {},
    );

    const now = new Date();

    first.registerAttempt(new Date(now.getTime() - 3_000));
    second.registerAttempt(new Date(now.getTime() - 2_000));
    third.registerAttempt(new Date(now.getTime() - 1_000));

    await repository.save(first);
    await repository.save(second);
    await repository.save(third);

    const result = await repository.findPending(10);

    expect(result.map((message) => message.messageId)).toEqual([
      first.messageId,
      second.messageId,
      third.messageId,
    ]);
  });

  it('should update an existing message', async () => {
    const message = OutboxMessage.create(
      crypto.randomUUID(),
      crypto.randomUUID(),
      'WALLET_UPDATED',
      { walletId: crypto.randomUUID() },
    );

    await repository.save(message);

    message.registerAttempt();
    message.markAsPublished();

    await repository.save(message);

    const found = await repository.findById(message.messageId);

    expect(found).not.toBeNull();
    expect(found?.attemptCount).toBe(1);
    expect(found?.isPublished).toBe(true);
    expect(found?.publishedDate).toBeInstanceOf(Date);
  });

  it('should not return messages scheduled for the future', async () => {
    const message = OutboxMessage.create(
      crypto.randomUUID(),
      crypto.randomUUID(),
      'WALLET_UPDATED',
      { walletId: crypto.randomUUID() },
    );

    const future = new Date(Date.now() + 60_000);

    message.registerAttempt(future);

    await repository.save(message);

    const result = await repository.findPending(10);

    expect(result).toHaveLength(0);
  });
});
