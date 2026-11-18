import { MikroORM } from '@mikro-orm/postgresql';

import mikroOrmConfig from '../../infrastructure/database/mikro-orm.config';
import { InboxMessageEntity } from '../../infrastructure/database/entities/inbox-message.entity';
import { MikroOrmInboxMessageRepository } from '../../infrastructure/database/repositories/mikro-orm-inbox-message.repository';
import { InboxService } from './inbox.service';

describe('InboxService integration', () => {
  let orm: MikroORM;
  let service: InboxService;

  beforeAll(async () => {
    orm = await MikroORM.init(mikroOrmConfig);
  });

  beforeEach(async () => {
    const em = orm.em.fork();

    await em.nativeDelete(InboxMessageEntity, {});
    em.clear();

    const repository = new MikroOrmInboxMessageRepository(
      orm.em.fork(),
    );

    service = new InboxService(repository);
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('should persist a new message and return NEW', async () => {
    const result = await service.process(
      'integration-message-1',
      'wallet-worker',
      'a'.repeat(64),
    );

    expect(result).toBe('NEW');

    const em = orm.em.fork();

    const persisted = await em.findOne(InboxMessageEntity, {
      messageId: 'integration-message-1',
      consumerName: 'wallet-worker',
    });

    expect(persisted).not.toBeNull();
    expect(persisted?.payloadHash).toBe('a'.repeat(64));
    expect(persisted?.processedAt).toBeNull();
  });

  it('should return DUPLICATE for an already persisted message', async () => {
    const firstResult = await service.process(
      'integration-message-2',
      'wallet-worker',
      'b'.repeat(64),
    );

    const secondResult = await service.process(
      'integration-message-2',
      'wallet-worker',
      'b'.repeat(64),
    );

    expect(firstResult).toBe('NEW');
    expect(secondResult).toBe('DUPLICATE');
  });

  it('should allow the same message id for different consumers', async () => {
    const walletResult = await service.process(
      'integration-message-3',
      'wallet-worker',
      'c'.repeat(64),
    );

    const ledgerResult = await service.process(
      'integration-message-3',
      'ledger-worker',
      'c'.repeat(64),
    );

    expect(walletResult).toBe('NEW');
    expect(ledgerResult).toBe('NEW');
  });
});