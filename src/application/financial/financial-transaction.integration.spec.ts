import { MikroORM } from '@mikro-orm/postgresql';

import { Money } from '../../domain/money/money';
import { Wallet } from '../../domain/wallet/wallet';

import { WalletEntity } from '../../infrastructure/database/entities/wallet.entity';
import { WagerTransactionEntity } from '../../infrastructure/database/entities/wager-transaction.entity';
import { LedgerEntryEntity } from '../../infrastructure/database/entities/ledger-entry.entity';
import { OutboxMessageEntity } from '../../infrastructure/database/entities/outbox-message.entity';

import mikroOrmConfig from '../../infrastructure/database/mikro-orm.config';

import { MikroOrmWalletRepository } from '../../infrastructure/database/repositories/mikro-orm-wallet.repository';
import { MikroOrmDatabaseTransaction } from '../../infrastructure/database/transaction/mikro-orm-database-transaction';

import { IdempotencyService } from '../idempotency/idempotency.service';
import { FinancialTransactionService } from './financial-transaction.service';
import { MikroOrmWagerTransactionRepository } from '../../infrastructure/database/repositories/mikro-orm-wager-transaction.repository';

describe('FinancialTransaction integration', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init(mikroOrmConfig);
  });

  afterAll(async () => {
    await orm.close(true);
  });

  beforeEach(async () => {
    await orm.em.nativeDelete(OutboxMessageEntity, {});
    await orm.em.nativeDelete(LedgerEntryEntity, {});
    await orm.em.nativeDelete(WagerTransactionEntity, {});
    await orm.em.nativeDelete(WalletEntity, {});
  });

  it('should process a BET atomically', async () => {
    const setupRepository = new MikroOrmWalletRepository(orm.em.fork());

    const wallet = Wallet.create(
      'player-financial',
      Money.from('100.00', 'BRL'),
    );

    await setupRepository.save(wallet);

    const databaseTransaction = new MikroOrmDatabaseTransaction(orm.em.fork());

    const idempotencyRepository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    const idempotencyService = new IdempotencyService(idempotencyRepository);

    const financialService = new FinancialTransactionService(
      databaseTransaction,
      idempotencyService,
    );

    const result = await financialService.create(
      {
        providerId: 'provider-1',
        externalTransactionId: 'external-1',
        idempotencyKey: 'idempotency-1',
        playerId: 'player-financial',
        walletId: wallet.walletId,
        roundId: 'round-1',
        gameId: 'game-1',
        amount: '30.00',
        currency: 'BRL',
        kind: 'BET',
      },
      'a'.repeat(64),
    );

    expect(result.replayed).toBe(false);
    expect(result.transaction.currentStatus).toBe('PENDING');

    const verificationRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWallet = await verificationRepository.findById(wallet.walletId);

    expect(finalWallet).not.toBeNull();
    expect(finalWallet?.currentBalance.amount).toBe('70.00');
    expect(finalWallet?.currentVersion).toBe(2);

    const verificationEm = orm.em.fork();

    const transaction = await verificationEm.findOne(WagerTransactionEntity, {
      id: result.transaction.transactionId,
    });

    expect(transaction).not.toBeNull();

    const ledger = await verificationEm.findOne(LedgerEntryEntity, {
      transaction: result.transaction.transactionId,
    });

    expect(ledger).not.toBeNull();
    expect(ledger?.direction).toBe('DEBIT');
    expect(ledger?.amount).toBe('30.00');
    expect(ledger?.balanceBefore).toBe('100.00');
    expect(ledger?.balanceAfter).toBe('70.00');

    const outbox = await verificationEm.findOne(OutboxMessageEntity, {
      aggregateId: result.transaction.transactionId,
    });

    expect(outbox).not.toBeNull();
    expect(outbox?.eventType).toBe('WAGER_TRANSACTION_PROCESSED');
  });
});
