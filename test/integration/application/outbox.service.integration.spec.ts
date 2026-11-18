import { MikroORM } from '@mikro-orm/postgresql';

import mikroOrmConfig from '../../../src/infrastructure/database/mikro-orm.config';
import { OutboxService } from '../../../src/application/outbox/outbox.service';
import { MikroOrmOutboxMessageRepository } from '../../../src/infrastructure/database/repositories/mikro-orm-outbox-message.repository';
import { OutboxMessageEntity } from '../../../src/infrastructure/database/entities/outbox-message.entity';

describe('OutboxService integration', () => {
  let orm: MikroORM;
  let service: OutboxService;

  beforeAll(async () => {
    orm = await MikroORM.init(mikroOrmConfig);

    const repository = new MikroOrmOutboxMessageRepository(
      orm.em.fork(),
    );

    service = new OutboxService(repository);
  });

  beforeEach(async () => {
    const em = orm.em.fork();

    await em.nativeDelete(OutboxMessageEntity, {});

    em.clear();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('should create and persist an outbox message', async () => {
    const messageId = crypto.randomUUID();
    const aggregateId = crypto.randomUUID();

    await service.createMessage(
      messageId,
      aggregateId,
      'WALLET_UPDATED',
      {
        walletId: aggregateId,
        amount: '100.00',
        currency: 'BRL',
      },
    );

    const em = orm.em.fork();

    const entity = await em.findOne(OutboxMessageEntity, {
      id: messageId,
    });

    expect(entity).not.toBeNull();
    expect(entity?.id).toBe(messageId);
    expect(entity?.aggregateId).toBe(aggregateId);
    expect(entity?.eventType).toBe('WALLET_UPDATED');
    expect(entity?.attempts).toBe(0);
    expect(entity?.publishedAt).toBeNull();
  });

  it('should persist an attempt registration', async () => {
    const messageId = crypto.randomUUID();
    const aggregateId = crypto.randomUUID();

    await service.createMessage(
      messageId,
      aggregateId,
      'WALLET_UPDATED',
      {},
    );

    const nextAttemptAt = new Date(Date.now() + 60_000);

    await service.registerAttempt(
      messageId,
      nextAttemptAt,
    );

    const em = orm.em.fork();

    const entity = await em.findOne(OutboxMessageEntity, {
      id: messageId,
    });

    expect(entity).not.toBeNull();
    expect(entity?.attempts).toBe(1);
    expect(entity?.nextAttemptAt).toEqual(nextAttemptAt);
  });

  it('should persist publication', async () => {
    const messageId = crypto.randomUUID();
    const aggregateId = crypto.randomUUID();

    await service.createMessage(
      messageId,
      aggregateId,
      'WALLET_UPDATED',
      {},
    );

    await service.markAsPublished(messageId);

    const em = orm.em.fork();

    const entity = await em.findOne(OutboxMessageEntity, {
      id: messageId,
    });

    expect(entity).not.toBeNull();
    expect(entity?.publishedAt).toBeInstanceOf(Date);
  });

  it('should throw when publishing a nonexistent message', async () => {
    const messageId = crypto.randomUUID();

    await expect(
      service.markAsPublished(messageId),
    ).rejects.toThrow(
      `Outbox message not found: ${messageId}`,
    );
  });

  it('should throw when registering an attempt for a nonexistent message', async () => {
    const messageId = crypto.randomUUID();

    await expect(
      service.registerAttempt(messageId),
    ).rejects.toThrow(
      `Outbox message not found: ${messageId}`,
    );
  });
});