import { MikroORM } from '@mikro-orm/postgresql';

import { InboxMessage } from '../../../domain/inbox/inbox-message';
import mikroOrmConfig from '../mikro-orm.config';
import { InboxMessageEntity } from '../entities/inbox-message.entity';
import { MikroOrmInboxMessageRepository } from './mikro-orm-inbox-message.repository';

describe('MikroOrmInboxMessageRepository', () => {
  let orm: MikroORM;
  let repository: MikroOrmInboxMessageRepository;

  beforeAll(async () => {
    orm = await MikroORM.init(mikroOrmConfig);
  });

  beforeEach(async () => {
    const em = orm.em.fork();

    await em.nativeDelete(InboxMessageEntity, {});

    em.clear();

    repository = new MikroOrmInboxMessageRepository(orm.em.fork());
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('should save and find an inbox message', async () => {
    const message = InboxMessage.create(
      'message-save-find',
      'wallet-worker',
      'a'.repeat(64),
    );

    await repository.save(message);

    const found = await repository.findById(
      'message-save-find',
      'wallet-worker',
    );

    console.log({
      id: found?.id,
      processedDate: found?.processedDate,
      isProcessed: found?.isProcessed,
    });

    expect(found).not.toBeNull();
    expect(found?.id).toBe('message-save-find');
    expect(found?.consumer).toBe('wallet-worker');
    expect(found?.hash).toBe('a'.repeat(64));
    expect(found?.isProcessed).toBe(false);
  });

  it('should return null when the message does not exist', async () => {
    const found = await repository.findById(
      'message-does-not-exist',
      'wallet-worker',
    );

    expect(found).toBeNull();
  });

  it('should update an existing message', async () => {
    const message = InboxMessage.create(
      'message-update',
      'wallet-worker',
      'a'.repeat(64),
    );

    await repository.save(message);

    message.markAsProcessed();

    await repository.save(message);

    const found = await repository.findById('message-update', 'wallet-worker');

    expect(found).not.toBeNull();
    expect(found?.isProcessed).toBe(true);
    expect(found?.processedDate).toBeDefined();
  });

  it('should allow the same message id for different consumers', async () => {
    const first = InboxMessage.create(
      'message-different-consumer',
      'wallet-worker',
      'a'.repeat(64),
    );

    const second = InboxMessage.create(
      'message-different-consumer',
      'audit-worker',
      'a'.repeat(64),
    );

    await repository.save(first);
    await repository.save(second);

    const walletMessage = await repository.findById(
      'message-different-consumer',
      'wallet-worker',
    );

    const auditMessage = await repository.findById(
      'message-different-consumer',
      'audit-worker',
    );
    expect(walletMessage).not.toBeNull();
    expect(auditMessage).not.toBeNull();
  });

  it('should enforce the composite primary key', async () => {
    const first = InboxMessage.create(
      'message-duplicate',
      'wallet-worker',
      'a'.repeat(64),
    );

    const second = InboxMessage.create(
      'message-duplicate',
      'wallet-worker',
      'b'.repeat(64),
    );

    await repository.save(first);

    const em = orm.em.fork();

    const entity = em.create(InboxMessageEntity, {
      messageId: second.id,
      consumerName: second.consumer,
      payloadHash: second.hash,
      receivedAt: second.receivedDate,
    });

    em.persist(entity);

    await expect(em.flush()).rejects.toThrow();
  });
});
