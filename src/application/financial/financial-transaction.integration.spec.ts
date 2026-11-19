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
import { FinancialTransactionRequest } from './financial-transaction.request';
import { WagerTransaction } from '../../domain/wager-transaction/wager-transaction';
import { LoggerService } from '../../infrastructure/observability/logger.service';

import { LOG_EVENTS } from '../../infrastructure/observability/log-events';
import { CorrelationIdService } from '../../infrastructure/observability/correlation-id.service';
import { WalletConcurrencyRetryService } from '../concurrency/wallet-concurrency-retry.service';

describe('FinancialTransaction integration', () => {
  let orm: MikroORM;
  const correlationIdService = new CorrelationIdService();

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

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as LoggerService;

    const financialService = new FinancialTransactionService(
      databaseTransaction,
      idempotencyService,
      logger,
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const request: FinancialTransactionRequest = {
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
    };

    const payloadHash = 'a'.repeat(64);

    const result = await financialService.create(request, payloadHash);

    expect(logger.info).toHaveBeenCalledWith(
      LOG_EVENTS.TRANSACTION_CREATED,
      expect.objectContaining({
        transactionId: result.transaction.transactionId,
        walletId: wallet.walletId,
        playerId: request.playerId,
        idempotencyKey: request.idempotencyKey,
      }),
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
    expect(outbox?.eventType).toBe('WagerTransactionProcessed');
  });

  it('should replay the same transaction without applying the financial operation twice', async () => {
    const wallet = Wallet.create('player-replay', Money.from('100.00', 'BRL'));

    const walletRepository = new MikroOrmWalletRepository(orm.em.fork());

    await walletRepository.save(wallet);

    const databaseTransaction = new MikroOrmDatabaseTransaction(orm.em.fork());

    const idempotencyRepository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    const idempotencyService = new IdempotencyService(idempotencyRepository);

    const logger = new LoggerService();

    const financialService = new FinancialTransactionService(
      databaseTransaction,
      idempotencyService,
      logger,
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const request: FinancialTransactionRequest = {
      providerId: 'provider-replay',
      externalTransactionId: 'external-replay',
      idempotencyKey: 'idempotency-replay',
      playerId: 'player-replay',
      walletId: wallet.walletId,
      roundId: 'round-replay',
      gameId: 'game-replay',
      amount: '30.00',
      currency: 'BRL',
      kind: 'BET',
    };

    const payloadHash = 'c'.repeat(64);

    const firstResult = await financialService.create(request, payloadHash);

    const secondResult = await financialService.create(request, payloadHash);

    expect(firstResult.replayed).toBe(false);
    expect(secondResult.replayed).toBe(true);

    expect(secondResult.transaction.transactionId).toBe(
      firstResult.transaction.transactionId,
    );

    const verificationRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWallet = await verificationRepository.findById(wallet.walletId);

    expect(finalWallet?.currentBalance.amount).toBe('70.00');
    expect(finalWallet?.currentVersion).toBe(2);

    const verificationEm = orm.em.fork();

    const transactions = await verificationEm.find(WagerTransactionEntity, {
      idempotencyKey: request.idempotencyKey,
    });

    const ledgerEntries = await verificationEm.find(LedgerEntryEntity, {
      wallet: wallet.walletId,
    });

    const outboxMessages = await verificationEm.find(OutboxMessageEntity, {
      aggregateId: firstResult.transaction.transactionId,
    });

    expect(transactions).toHaveLength(1);
    expect(ledgerEntries).toHaveLength(1);
    expect(outboxMessages).toHaveLength(1);
  });

  it('should reject the transaction when balance is insufficient', async () => {
    const wallet = Wallet.create(
      'player-insufficient',
      Money.from('20.00', 'BRL'),
    );

    const walletRepository = new MikroOrmWalletRepository(orm.em.fork());

    await walletRepository.save(wallet);

    const databaseTransaction = new MikroOrmDatabaseTransaction(orm.em.fork());

    const idempotencyRepository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    const idempotencyService = new IdempotencyService(idempotencyRepository);

    const logger = new LoggerService();

    const financialService = new FinancialTransactionService(
      databaseTransaction,
      idempotencyService,
      logger,
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const request: FinancialTransactionRequest = {
      providerId: 'provider-insufficient',
      externalTransactionId: 'external-insufficient',
      idempotencyKey: 'idempotency-insufficient',
      playerId: 'player-insufficient',
      walletId: wallet.walletId,
      roundId: 'round-insufficient',
      gameId: 'game-insufficient',
      amount: '30.00',
      currency: 'BRL',
      kind: 'BET',
    };

    const payloadHash = 'b'.repeat(64);

    const result = await financialService.create(request, payloadHash);

    expect(result.replayed).toBe(false);
    expect(result.transaction.currentStatus).toBe('REJECTED');
    expect(result.transaction.errorCode).toBe('INSUFFICIENT_BALANCE');

    const verificationEm = orm.em.fork();

    const savedWallet = await verificationEm.findOne(WalletEntity, {
      id: wallet.walletId,
    });

    const savedTransaction = await verificationEm.findOne(
      WagerTransactionEntity,
      {
        idempotencyKey: request.idempotencyKey,
      },
    );

    const savedLedger = await verificationEm.findOne(LedgerEntryEntity, {
      wallet: wallet.walletId,
    });

    const savedOutbox = await verificationEm.findOne(OutboxMessageEntity, {
      aggregateId: result.transaction.transactionId,
    });

    expect(savedWallet?.balance).toBe('20.00');
    expect(savedWallet?.version).toBe(1);

    expect(savedTransaction?.status).toBe('REJECTED');
    expect(savedTransaction?.failureCode).toBe('INSUFFICIENT_BALANCE');

    expect(savedLedger).toBeNull();

    expect(savedOutbox).not.toBeNull();
    expect(savedOutbox?.eventType).toBe('WagerTransactionRejected');
  });

  it('should rollback wallet changes when a later operation fails', async () => {
    const wallet = Wallet.create(
      'player-atomicity',
      Money.from('100.00', 'BRL'),
    );

    const walletRepository = new MikroOrmWalletRepository(orm.em.fork());

    await walletRepository.save(wallet);

    const transactionRepository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    const existingTransaction = WagerTransaction.create({
      providerId: 'provider-atomicity',
      externalTransactionId: 'external-atomicity',
      idempotencyKey: 'existing-idempotency',
      payloadHash: 'f'.repeat(64),
      walletId: wallet.walletId,
      playerId: 'player-atomicity',
      roundId: 'round-existing',
      gameId: 'game-existing',
      amount: Money.from('10.00', 'BRL'),
      kind: 'BET',
    });

    await transactionRepository.save(existingTransaction);

    const databaseTransaction = new MikroOrmDatabaseTransaction(orm.em.fork());

    const idempotencyRepository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    const idempotencyService = new IdempotencyService(idempotencyRepository);

    const logger = new LoggerService();

    const financialService = new FinancialTransactionService(
      databaseTransaction,
      idempotencyService,
      logger,
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const request: FinancialTransactionRequest = {
      providerId: 'provider-atomicity',
      externalTransactionId: 'external-atomicity',
      idempotencyKey: 'new-idempotency',
      playerId: 'player-atomicity',
      walletId: wallet.walletId,
      roundId: 'round-new',
      gameId: 'game-new',
      amount: '30.00',
      currency: 'BRL',
      kind: 'BET',
    };

    await expect(
      financialService.create(request, 'a'.repeat(64)),
    ).rejects.toThrow();

    const verificationRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWallet = await verificationRepository.findById(wallet.walletId);

    expect(finalWallet?.currentBalance.amount).toBe('100.00');
    expect(finalWallet?.currentVersion).toBe(1);

    const verificationEm = orm.em.fork();

    const transactions = await verificationEm.find(WagerTransactionEntity, {
      wallet: wallet.walletId,
    });

    const ledgerEntries = await verificationEm.find(LedgerEntryEntity, {
      wallet: wallet.walletId,
    });

    const outboxMessages = await verificationEm.find(OutboxMessageEntity, {
      aggregateId: wallet.walletId,
    });

    expect(transactions).toHaveLength(1);
    expect(ledgerEntries).toHaveLength(0);
    expect(outboxMessages).toHaveLength(0);
  });

  it('should protect the financial operation against concurrent updates', async () => {
    const setupRepository = new MikroOrmWalletRepository(orm.em.fork());

    const wallet = Wallet.create(
      'player-financial-concurrent',
      Money.from('100.00', 'BRL'),
    );

    await setupRepository.save(wallet);

    const createFinancialService = () => {
      const databaseTransaction = new MikroOrmDatabaseTransaction(
        orm.em.fork(),
      );

      const idempotencyRepository = new MikroOrmWagerTransactionRepository(
        orm.em.fork(),
      );

      const idempotencyService = new IdempotencyService(idempotencyRepository);

      const logger = new LoggerService();

      return new FinancialTransactionService(
        databaseTransaction,
        idempotencyService,
        logger,
        correlationIdService,
        new WalletConcurrencyRetryService(),
      );
    };

    const serviceA = createFinancialService();
    const serviceB = createFinancialService();

    const requestA: FinancialTransactionRequest = {
      providerId: 'provider-concurrent-a',
      externalTransactionId: 'external-concurrent-a',
      idempotencyKey: 'idempotency-concurrent-a',
      playerId: 'player-financial-concurrent',
      walletId: wallet.walletId,
      roundId: 'round-concurrent',
      gameId: 'game-concurrent',
      amount: '30.00',
      currency: 'BRL',
      kind: 'BET',
    };

    const requestB: FinancialTransactionRequest = {
      providerId: 'provider-concurrent-b',
      externalTransactionId: 'external-concurrent-b',
      idempotencyKey: 'idempotency-concurrent-b',
      playerId: 'player-financial-concurrent',
      walletId: wallet.walletId,
      roundId: 'round-concurrent',
      gameId: 'game-concurrent',
      amount: '50.00',
      currency: 'BRL',
      kind: 'BET',
    };

    const [resultA, resultB] = await Promise.allSettled([
      serviceA.create(requestA, 'a'.repeat(64)),
      serviceB.create(requestB, 'b'.repeat(64)),
    ]);

    console.log('RESULT A:', resultA);
    console.log('RESULT B:', resultB);
    expect(resultA.status).toBe('fulfilled');
    expect(resultB.status).toBe('fulfilled');

    if (resultA.status !== 'fulfilled' || resultB.status !== 'fulfilled') {
      throw new Error('Both concurrent financial operations should succeed');
    }

    expect(resultA.value.replayed).toBe(false);
    expect(resultB.value.replayed).toBe(false);

    const verificationRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWallet = await verificationRepository.findById(wallet.walletId);

    expect(finalWallet).not.toBeNull();
    expect(finalWallet!.currentBalance.amount).toBe('20.00');

    const verificationEm = orm.em.fork();

    const transactions = await verificationEm.find(WagerTransactionEntity, {
      wallet: wallet.walletId,
    });

    const ledgerEntries = await verificationEm.find(LedgerEntryEntity, {
      wallet: wallet.walletId,
    });

    const outboxMessages = await verificationEm.find(OutboxMessageEntity, {
      aggregateId: {
        $in: transactions.map((transaction) => transaction.id),
      },
    });

    expect(transactions).toHaveLength(2);
    expect(ledgerEntries).toHaveLength(2);
    expect(outboxMessages).toHaveLength(2);

    const ledgerAmounts = ledgerEntries.map((entry) => entry.amount).sort();

    expect(ledgerAmounts).toEqual(['30.00', '50.00']);
  });

  it('should process a WIN as a credit', async () => {
    const wallet = Wallet.create('player-win', Money.from('100.00', 'BRL'));

    await new MikroOrmWalletRepository(orm.em.fork()).save(wallet);

    const financialService = new FinancialTransactionService(
      new MikroOrmDatabaseTransaction(orm.em.fork()),
      new IdempotencyService(
        new MikroOrmWagerTransactionRepository(orm.em.fork()),
      ),
      new LoggerService(),
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const request: FinancialTransactionRequest = {
      providerId: 'provider-win',
      externalTransactionId: 'external-win',
      idempotencyKey: 'idempotency-win',
      playerId: 'player-win',
      walletId: wallet.walletId,
      roundId: 'round-win',
      gameId: 'game-win',
      amount: '50.00',
      currency: 'BRL',
      kind: 'WIN',
    };

    const result = await financialService.create(request, 'w'.repeat(64));

    const finalWallet = await new MikroOrmWalletRepository(
      orm.em.fork(),
    ).findById(wallet.walletId);

    expect(finalWallet?.currentBalance.amount).toBe('150.00');

    const ledger = await orm.em.fork().findOne(LedgerEntryEntity, {
      transaction: result.transaction.transactionId,
    });

    expect(ledger?.direction).toBe('CREDIT');
    expect(ledger?.balanceBefore).toBe('100.00');
    expect(ledger?.balanceAfter).toBe('150.00');
  });

  it('should process a LOSS without changing the balance', async () => {
    const wallet = Wallet.create('player-loss', Money.from('100.00', 'BRL'));

    await new MikroOrmWalletRepository(orm.em.fork()).save(wallet);

    const financialService = new FinancialTransactionService(
      new MikroOrmDatabaseTransaction(orm.em.fork()),
      new IdempotencyService(
        new MikroOrmWagerTransactionRepository(orm.em.fork()),
      ),
      new LoggerService(),
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const request: FinancialTransactionRequest = {
      providerId: 'provider-loss',
      externalTransactionId: 'external-loss',
      idempotencyKey: 'idempotency-loss',
      playerId: 'player-loss',
      walletId: wallet.walletId,
      roundId: 'round-loss',
      gameId: 'game-loss',
      amount: '40.00',
      currency: 'BRL',
      kind: 'LOSS',
    };

    const result = await financialService.create(request, 'l'.repeat(64));

    const finalWallet = await new MikroOrmWalletRepository(
      orm.em.fork(),
    ).findById(wallet.walletId);

    expect(finalWallet?.currentBalance.amount).toBe('100.00');

    const ledger = await orm.em.fork().findOne(LedgerEntryEntity, {
      transaction: result.transaction.transactionId,
    });

    expect(ledger).toBeNull();
  });

  it('should process a REFUND as a credit', async () => {
    const wallet = Wallet.create('player-refund', Money.from('100.00', 'BRL'));

    await new MikroOrmWalletRepository(orm.em.fork()).save(wallet);

    const referenceTransaction = WagerTransaction.create({
      providerId: 'provider-refund',
      externalTransactionId: 'external-bet-reference',
      idempotencyKey: 'idempotency-bet-reference',
      payloadHash: 'b'.repeat(64),
      walletId: wallet.walletId,
      playerId: 'player-refund',
      roundId: 'round-refund',
      gameId: 'game-refund',
      amount: Money.from('30.00', 'BRL'),
      kind: 'BET',
    });

    await new MikroOrmWagerTransactionRepository(orm.em.fork()).save(
      referenceTransaction,
    );

    const financialService = new FinancialTransactionService(
      new MikroOrmDatabaseTransaction(orm.em.fork()),
      new IdempotencyService(
        new MikroOrmWagerTransactionRepository(orm.em.fork()),
      ),
      new LoggerService(),
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const request: FinancialTransactionRequest = {
      providerId: 'provider-refund',
      externalTransactionId: 'external-refund',
      idempotencyKey: 'idempotency-refund',
      playerId: 'player-refund',
      walletId: wallet.walletId,
      roundId: 'round-refund',
      gameId: 'game-refund',
      amount: '30.00',
      currency: 'BRL',
      kind: 'REFUND',
      referenceExternalTransactionId: 'external-bet-reference',
    };

    const result = await financialService.create(request, 'r'.repeat(64));

    const finalWallet = await new MikroOrmWalletRepository(
      orm.em.fork(),
    ).findById(wallet.walletId);

    expect(finalWallet?.currentBalance.amount).toBe('130.00');
    expect(result.transaction.referenceExternalId).toBe(
      'external-bet-reference',
    );

    const ledger = await orm.em.fork().findOne(LedgerEntryEntity, {
      transaction: result.transaction.transactionId,
    });

    expect(ledger?.direction).toBe('CREDIT');
  });

  it('should process a ROLLBACK as a credit', async () => {
    const wallet = Wallet.create(
      'player-rollback',
      Money.from('100.00', 'BRL'),
    );

    await new MikroOrmWalletRepository(orm.em.fork()).save(wallet);

    const referenceTransaction = WagerTransaction.create({
      providerId: 'provider-rollback',
      externalTransactionId: 'external-bet-reference',
      idempotencyKey: 'idempotency-bet-reference',
      payloadHash: 'b'.repeat(64),
      walletId: wallet.walletId,
      playerId: 'player-rollback',
      roundId: 'round-rollback',
      gameId: 'game-rollback',
      amount: Money.from('20.00', 'BRL'),
      kind: 'BET',
    });

    await new MikroOrmWagerTransactionRepository(orm.em.fork()).save(
      referenceTransaction,
    );

    const financialService = new FinancialTransactionService(
      new MikroOrmDatabaseTransaction(orm.em.fork()),
      new IdempotencyService(
        new MikroOrmWagerTransactionRepository(orm.em.fork()),
      ),
      new LoggerService(),
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const request: FinancialTransactionRequest = {
      providerId: 'provider-rollback',
      externalTransactionId: 'external-rollback',
      idempotencyKey: 'idempotency-rollback',
      playerId: 'player-rollback',
      walletId: wallet.walletId,
      roundId: 'round-rollback',
      gameId: 'game-rollback',
      amount: '20.00',
      currency: 'BRL',
      kind: 'ROLLBACK',
      referenceExternalTransactionId: 'external-bet-reference',
    };

    const result = await financialService.create(request, 'k'.repeat(64));

    const finalWallet = await new MikroOrmWalletRepository(
      orm.em.fork(),
    ).findById(wallet.walletId);

    expect(finalWallet?.currentBalance.amount).toBe('120.00');

    const ledger = await orm.em.fork().findOne(LedgerEntryEntity, {
      transaction: result.transaction.transactionId,
    });

    expect(ledger?.direction).toBe('CREDIT');
  });

  it('should process a ROLLBACK as a debit when referencing a WIN', async () => {
    const wallet = Wallet.create(
      'player-rollback-win',
      Money.from('100.00', 'BRL'),
    );

    await new MikroOrmWalletRepository(orm.em.fork()).save(wallet);

    const referenceTransaction = WagerTransaction.create({
      providerId: 'provider-rollback-win',
      externalTransactionId: 'external-win-reference',
      idempotencyKey: 'idempotency-win-reference',
      payloadHash: 'b'.repeat(64),
      walletId: wallet.walletId,
      playerId: 'player-rollback-win',
      roundId: 'round-rollback-win',
      gameId: 'game-rollback-win',
      amount: Money.from('20.00', 'BRL'),
      kind: 'WIN',
    });

    await new MikroOrmWagerTransactionRepository(orm.em.fork()).save(
      referenceTransaction,
    );

    const financialService = new FinancialTransactionService(
      new MikroOrmDatabaseTransaction(orm.em.fork()),
      new IdempotencyService(
        new MikroOrmWagerTransactionRepository(orm.em.fork()),
      ),
      new LoggerService(),
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const winRequest: FinancialTransactionRequest = {
      providerId: 'provider-rollback-win',
      externalTransactionId: 'external-win',
      idempotencyKey: 'idempotency-win',
      playerId: 'player-rollback-win',
      walletId: wallet.walletId,
      roundId: 'round-rollback-win',
      gameId: 'game-rollback-win',
      amount: '20.00',
      currency: 'BRL',
      kind: 'WIN',
    };

    await financialService.create(winRequest, 'w'.repeat(64));

    const rollbackRequest: FinancialTransactionRequest = {
      providerId: 'provider-rollback-win',
      externalTransactionId: 'external-rollback-win',
      idempotencyKey: 'idempotency-rollback-win',
      playerId: 'player-rollback-win',
      walletId: wallet.walletId,
      roundId: 'round-rollback-win',
      gameId: 'game-rollback-win',
      amount: '20.00',
      currency: 'BRL',
      kind: 'ROLLBACK',
      referenceExternalTransactionId: 'external-win',
    };

    const result = await financialService.create(
      rollbackRequest,
      'r'.repeat(64),
    );

    const finalWallet = await new MikroOrmWalletRepository(
      orm.em.fork(),
    ).findById(wallet.walletId);

    expect(finalWallet?.currentBalance.amount).toBe('100.00');

    const ledger = await orm.em.fork().findOne(LedgerEntryEntity, {
      transaction: result.transaction.transactionId,
    });

    expect(ledger?.direction).toBe('DEBIT');
  });

  it('should create a transaction as PENDING_REFERENCE when reference does not exist', async () => {
    const wallet = Wallet.create(
      'player-pending-reference',
      Money.from('100.00', 'BRL'),
    );

    await new MikroOrmWalletRepository(orm.em.fork()).save(wallet);

    const financialService = new FinancialTransactionService(
      new MikroOrmDatabaseTransaction(orm.em.fork()),
      new IdempotencyService(
        new MikroOrmWagerTransactionRepository(orm.em.fork()),
      ),
      new LoggerService(),
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const request: FinancialTransactionRequest = {
      providerId: 'provider-pending-reference',
      externalTransactionId: 'external-refund-pending',
      idempotencyKey: 'idempotency-refund-pending',
      playerId: 'player-pending-reference',
      walletId: wallet.walletId,
      roundId: 'round-pending-reference',
      gameId: 'game-pending-reference',
      amount: '30.00',
      currency: 'BRL',
      kind: 'REFUND',
      referenceExternalTransactionId: 'external-bet-does-not-exist',
    };

    const result = await financialService.create(request, 'p'.repeat(64));

    expect(result.replayed).toBe(false);
    expect(result.transaction.currentStatus).toBe('PENDING_REFERENCE');
    expect(result.transaction.referenceExternalId).toBe(
      'external-bet-does-not-exist',
    );

    const verificationRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWallet = await verificationRepository.findById(wallet.walletId);

    expect(finalWallet?.currentBalance.amount).toBe('100.00');

    const verificationEm = orm.em.fork();

    const transactions = await verificationEm.find(WagerTransactionEntity, {
      wallet: wallet.walletId,
    });

    const ledgerEntries = await verificationEm.find(LedgerEntryEntity, {
      wallet: wallet.walletId,
    });

    expect(transactions).toHaveLength(1);
    expect(ledgerEntries).toHaveLength(0);
  });

  it('should reprocess a pending reference when the reference arrives later', async () => {
    const wallet = Wallet.create(
      'player-pending-reprocess',
      Money.from('100.00', 'BRL'),
    );

    const walletRepository = new MikroOrmWalletRepository(orm.em.fork());

    await walletRepository.save(wallet);

    const financialService = new FinancialTransactionService(
      new MikroOrmDatabaseTransaction(orm.em.fork()),
      new IdempotencyService(
        new MikroOrmWagerTransactionRepository(orm.em.fork()),
      ),
      new LoggerService(),
      correlationIdService,
      new WalletConcurrencyRetryService(),
    );

    const pendingRequest: FinancialTransactionRequest = {
      providerId: 'provider-pending-reprocess',
      externalTransactionId: 'external-refund-pending',
      idempotencyKey: 'idempotency-refund-pending',
      playerId: 'player-pending-reprocess',
      walletId: wallet.walletId,
      roundId: 'round-pending-reprocess',
      gameId: 'game-pending-reprocess',
      amount: '30.00',
      currency: 'BRL',
      kind: 'REFUND',
      referenceExternalTransactionId: 'external-bet-late',
    };

    const pendingResult = await financialService.create(
      pendingRequest,
      'p'.repeat(64),
    );

    expect(pendingResult.transaction.currentStatus).toBe('PENDING_REFERENCE');

    const balanceBeforeReference = await walletRepository.findById(
      wallet.walletId,
    );

    expect(balanceBeforeReference?.currentBalance.amount).toBe('100.00');

    // A transação de referência chega depois.
    const referenceTransaction = WagerTransaction.create({
      providerId: 'provider-pending-reprocess',
      externalTransactionId: 'external-bet-late',
      idempotencyKey: 'idempotency-bet-late',
      payloadHash: 'b'.repeat(64),
      walletId: wallet.walletId,
      playerId: 'player-pending-reprocess',
      roundId: 'round-pending-reprocess',
      gameId: 'game-pending-reprocess',
      amount: Money.from('30.00', 'BRL'),
      kind: 'BET',
    });

    await new MikroOrmWagerTransactionRepository(orm.em.fork()).save(
      referenceTransaction,
    );

    // Busca a transação pendente.
    const transactionRepository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    const pendingTransactions =
      await transactionRepository.findPendingReferences();

    expect(pendingTransactions).toHaveLength(1);
    expect(pendingTransactions[0].transactionId).toBe(
      pendingResult.transaction.transactionId,
    );

    // Reprocessa.
    const reprocessedResult = await financialService.reprocessPendingReference(
      pendingTransactions[0],
    );

    expect(reprocessedResult.replayed).toBe(false);
    expect(reprocessedResult.transaction.currentStatus).toBe('PENDING');

    // Cria um repository novo para garantir que a consulta
    // seja feita com um EntityManager/Identity Map novo.
    const walletRepositoryAfterReprocess = new MikroOrmWalletRepository(
      orm.em.fork(),
    );

    const walletAfterReprocess = await walletRepositoryAfterReprocess.findById(
      wallet.walletId,
    );

    expect(walletAfterReprocess?.currentBalance.amount).toBe('130.00');

    // A transação não deve mais estar pendente.
    const transactionRepositoryAfterReprocess =
      new MikroOrmWagerTransactionRepository(orm.em.fork());

    const pendingAfterReprocess =
      await transactionRepositoryAfterReprocess.findPendingReferences();

    expect(pendingAfterReprocess).toHaveLength(0);

    // Consulta final usando outro repository novo.
    const finalWalletRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWallet = await finalWalletRepository.findById(wallet.walletId);

    expect(finalWallet?.currentBalance.amount).toBe('130.00');

    const verificationEm = orm.em.fork();

    const transactions = await verificationEm.find(WagerTransactionEntity, {
      wallet: wallet.walletId,
    });

    const ledgerEntries = await verificationEm.find(LedgerEntryEntity, {
      wallet: wallet.walletId,
    });

    const outboxMessages = await verificationEm.find(OutboxMessageEntity, {
      aggregateId: pendingResult.transaction.transactionId,
    });

    expect(transactions).toHaveLength(2);
    expect(ledgerEntries).toHaveLength(1);
    expect(outboxMessages).toHaveLength(1);

    expect(ledgerEntries[0].direction).toBe('CREDIT');
    expect(ledgerEntries[0].amount).toBe('30.00');
    expect(ledgerEntries[0].balanceBefore).toBe('100.00');
    expect(ledgerEntries[0].balanceAfter).toBe('130.00');
  });

  it('should process the same bet 50 times concurrently with only one debit', async () => {
    const wallet = Wallet.create(
      'player-50-same-bet',
      Money.from('100.00', 'BRL'),
    );

    await new MikroOrmWalletRepository(orm.em.fork()).save(wallet);

    const createFinancialService = () => {
      const databaseTransaction = new MikroOrmDatabaseTransaction(
        orm.em.fork(),
      );

      const idempotencyRepository = new MikroOrmWagerTransactionRepository(
        orm.em.fork(),
      );

      const idempotencyService = new IdempotencyService(idempotencyRepository);

      return new FinancialTransactionService(
        databaseTransaction,
        idempotencyService,
        new LoggerService(),
        correlationIdService,
        new WalletConcurrencyRetryService(),
      );
    };

    const services = Array.from({ length: 50 }, createFinancialService);

    const request = {
      providerId: 'provider-50-same-bet',
      externalTransactionId: 'external-50-same-bet',
      idempotencyKey: 'idempotency-50-same-bet',
      playerId: 'player-50-same-bet',
      walletId: wallet.walletId,
      roundId: 'round-50-same-bet',
      gameId: 'game-50-same-bet',
      amount: '50.00',
      currency: 'BRL' as const,
      kind: 'BET' as const,
    };

    const payloadHash = 'a'.repeat(64);

    const results = await Promise.all(
      services.map((service) => service.create(request, payloadHash)),
    );

    expect(results).toHaveLength(50);

    const uniqueTransactionIds = new Set(
      results.map((result) => result.transaction.transactionId),
    );

    expect(uniqueTransactionIds.size).toBe(1);

    const replayedResults = results.filter(
      (result) => result.replayed === true,
    );

    expect(replayedResults).toHaveLength(49);

    const originalResults = results.filter(
      (result) => result.replayed === false,
    );

    expect(originalResults).toHaveLength(1);

    const verificationRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWallet = await verificationRepository.findById(wallet.walletId);

    expect(finalWallet).not.toBeNull();
    expect(finalWallet!.currentBalance.amount).toBe('50.00');

    const verificationEm = orm.em.fork();

    const ledgerEntries = await verificationEm.find(LedgerEntryEntity, {
      wallet: wallet.walletId,
    });

    expect(ledgerEntries).toHaveLength(1);

    expect(ledgerEntries[0].direction).toBe('DEBIT');
    expect(ledgerEntries[0].amount).toBe('50.00');
  });

  it('should allow only one of two simultaneous bets when balance is insufficient', async () => {
    const wallet = Wallet.create(
      'player-competing-bets',
      Money.from('100.00', 'BRL'),
    );

    await new MikroOrmWalletRepository(orm.em.fork()).save(wallet);

    const createFinancialService = () => {
      const databaseTransaction = new MikroOrmDatabaseTransaction(
        orm.em.fork(),
      );

      const idempotencyRepository = new MikroOrmWagerTransactionRepository(
        orm.em.fork(),
      );

      const idempotencyService = new IdempotencyService(idempotencyRepository);

      return new FinancialTransactionService(
        databaseTransaction,
        idempotencyService,
        new LoggerService(),
        correlationIdService,
        new WalletConcurrencyRetryService(),
      );
    };

    const serviceA = createFinancialService();
    const serviceB = createFinancialService();

    const requestA: FinancialTransactionRequest = {
      providerId: 'provider-competing-a',
      externalTransactionId: 'external-competing-a',
      idempotencyKey: 'idempotency-competing-a',
      playerId: 'player-competing-bets',
      walletId: wallet.walletId,
      roundId: 'round-competing',
      gameId: 'game-competing',
      amount: '80.00',
      currency: 'BRL',
      kind: 'BET',
    };

    const requestB: FinancialTransactionRequest = {
      providerId: 'provider-competing-b',
      externalTransactionId: 'external-competing-b',
      idempotencyKey: 'idempotency-competing-b',
      playerId: 'player-competing-bets',
      walletId: wallet.walletId,
      roundId: 'round-competing',
      gameId: 'game-competing',
      amount: '80.00',
      currency: 'BRL',
      kind: 'BET',
    };

    const [resultA, resultB] = await Promise.all([
      serviceA.create(requestA, 'a'.repeat(64)),
      serviceB.create(requestB, 'b'.repeat(64)),
    ]);

    const results = [resultA, resultB];

    const processedResults = results.filter(
      (result) => result.transaction.currentStatus === 'PENDING',
    );

    const rejectedResults = results.filter(
      (result) => result.transaction.currentStatus === 'REJECTED',
    );

    expect(processedResults).toHaveLength(1);
    expect(rejectedResults).toHaveLength(1);

    expect(rejectedResults[0].transaction.errorCode).toBe(
      'INSUFFICIENT_BALANCE',
    );

    const verificationRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWallet = await verificationRepository.findById(wallet.walletId);

    expect(finalWallet).not.toBeNull();
    expect(finalWallet!.currentBalance.amount).toBe('20.00');

    const verificationEm = orm.em.fork();

    const transactions = await verificationEm.find(WagerTransactionEntity, {
      wallet: wallet.walletId,
    });

    const ledgerEntries = await verificationEm.find(LedgerEntryEntity, {
      wallet: wallet.walletId,
    });

    expect(transactions).toHaveLength(2);

    expect(ledgerEntries).toHaveLength(1);

    expect(ledgerEntries[0].direction).toBe('DEBIT');
    expect(ledgerEntries[0].amount).toBe('80.00');
  });

  it('should process transactions on distinct wallets in parallel', async () => {
    const walletA = Wallet.create(
      'player-distinct-a',
      Money.from('100.00', 'BRL'),
    );

    const walletB = Wallet.create(
      'player-distinct-b',
      Money.from('100.00', 'BRL'),
    );

    const walletRepository = new MikroOrmWalletRepository(orm.em.fork());

    await walletRepository.save(walletA);
    await walletRepository.save(walletB);

    const createFinancialService = () => {
      return new FinancialTransactionService(
        new MikroOrmDatabaseTransaction(orm.em.fork()),
        new IdempotencyService(
          new MikroOrmWagerTransactionRepository(orm.em.fork()),
        ),
        new LoggerService(),
        correlationIdService,
        new WalletConcurrencyRetryService(),
      );
    };

    const serviceA = createFinancialService();
    const serviceB = createFinancialService();

    const requestA: FinancialTransactionRequest = {
      providerId: 'provider-distinct-a',
      externalTransactionId: 'external-distinct-a',
      idempotencyKey: 'idempotency-distinct-a',
      playerId: 'player-distinct-a',
      walletId: walletA.walletId,
      roundId: 'round-distinct',
      gameId: 'game-distinct',
      amount: '30.00',
      currency: 'BRL',
      kind: 'BET',
    };

    const requestB: FinancialTransactionRequest = {
      providerId: 'provider-distinct-b',
      externalTransactionId: 'external-distinct-b',
      idempotencyKey: 'idempotency-distinct-b',
      playerId: 'player-distinct-b',
      walletId: walletB.walletId,
      roundId: 'round-distinct',
      gameId: 'game-distinct',
      amount: '40.00',
      currency: 'BRL',
      kind: 'BET',
    };

    const [resultA, resultB] = await Promise.all([
      serviceA.create(requestA, 'a'.repeat(64)),
      serviceB.create(requestB, 'b'.repeat(64)),
    ]);

    expect(resultA.replayed).toBe(false);
    expect(resultB.replayed).toBe(false);

    expect(resultA.transaction.currentStatus).toBe('PENDING');
    expect(resultB.transaction.currentStatus).toBe('PENDING');

    const verificationRepository = new MikroOrmWalletRepository(orm.em.fork());

    const finalWalletA = await verificationRepository.findById(
      walletA.walletId,
    );

    const finalWalletB = await verificationRepository.findById(
      walletB.walletId,
    );

    expect(finalWalletA).not.toBeNull();
    expect(finalWalletB).not.toBeNull();

    expect(finalWalletA!.currentBalance.amount).toBe('70.00');
    expect(finalWalletB!.currentBalance.amount).toBe('60.00');

    const verificationEm = orm.em.fork();

    const ledgerEntriesA = await verificationEm.find(LedgerEntryEntity, {
      wallet: walletA.walletId,
    });

    const ledgerEntriesB = await verificationEm.find(LedgerEntryEntity, {
      wallet: walletB.walletId,
    });

    expect(ledgerEntriesA).toHaveLength(1);
    expect(ledgerEntriesB).toHaveLength(1);

    expect(ledgerEntriesA[0].direction).toBe('DEBIT');
    expect(ledgerEntriesA[0].amount).toBe('30.00');

    expect(ledgerEntriesB[0].direction).toBe('DEBIT');
    expect(ledgerEntriesB[0].amount).toBe('40.00');
  });

  it('should remain correct with three independent application instances', async () => {
    const setupRepository = new MikroOrmWalletRepository(orm.em.fork());

    const wallet = Wallet.create(
      'player-three-instances',
      Money.from('100.00', 'BRL'),
    );

    await setupRepository.save(wallet);

    const ormA = await MikroORM.init(mikroOrmConfig);
    const ormB = await MikroORM.init(mikroOrmConfig);
    const ormC = await MikroORM.init(mikroOrmConfig);

    try {
      const createFinancialService = (instanceOrm: MikroORM) => {
        const databaseTransaction = new MikroOrmDatabaseTransaction(
          instanceOrm.em.fork(),
        );

        const idempotencyRepository = new MikroOrmWagerTransactionRepository(
          instanceOrm.em.fork(),
        );

        const idempotencyService = new IdempotencyService(
          idempotencyRepository,
        );

        const logger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        } as unknown as LoggerService;

        return new FinancialTransactionService(
          databaseTransaction,
          idempotencyService,
          logger,
          new CorrelationIdService(),
          new WalletConcurrencyRetryService(),
        );
      };

      const serviceA = createFinancialService(ormA);
      const serviceB = createFinancialService(ormB);
      const serviceC = createFinancialService(ormC);

      const requests: FinancialTransactionRequest[] = [
        {
          providerId: 'provider-three-instances',
          externalTransactionId: 'external-instance-a',
          idempotencyKey: 'idempotency-instance-a',
          playerId: 'player-three-instances',
          walletId: wallet.walletId,
          roundId: 'round-instance-a',
          gameId: 'game-instance-a',
          amount: '30.00',
          currency: 'BRL',
          kind: 'BET',
        },
        {
          providerId: 'provider-three-instances',
          externalTransactionId: 'external-instance-b',
          idempotencyKey: 'idempotency-instance-b',
          playerId: 'player-three-instances',
          walletId: wallet.walletId,
          roundId: 'round-instance-b',
          gameId: 'game-instance-b',
          amount: '30.00',
          currency: 'BRL',
          kind: 'BET',
        },
        {
          providerId: 'provider-three-instances',
          externalTransactionId: 'external-instance-c',
          idempotencyKey: 'idempotency-instance-c',
          playerId: 'player-three-instances',
          walletId: wallet.walletId,
          roundId: 'round-instance-c',
          gameId: 'game-instance-c',
          amount: '30.00',
          currency: 'BRL',
          kind: 'BET',
        },
      ];

      const results = await Promise.all([
        serviceA.create(requests[0], 'a'.repeat(64)),
        serviceB.create(requests[1], 'b'.repeat(64)),
        serviceC.create(requests[2], 'c'.repeat(64)),
      ]);

      expect(results).toHaveLength(3);

      const verificationRepository = new MikroOrmWalletRepository(
        orm.em.fork(),
      );

      const finalWallet = await verificationRepository.findById(
        wallet.walletId,
      );

      expect(finalWallet).not.toBeNull();
      expect(finalWallet!.currentBalance.amount).toBe('10.00');

      const verificationEm = orm.em.fork();

      const transactions = await verificationEm.find(
        WagerTransactionEntity,
        {},
      );

      expect(transactions).toHaveLength(3);

      const ledgerEntries = await verificationEm.find(LedgerEntryEntity, {});

      expect(ledgerEntries).toHaveLength(3);

      expect(ledgerEntries.every((entry) => entry.direction === 'DEBIT')).toBe(
        true,
      );

      expect(ledgerEntries.every((entry) => entry.amount === '30.00')).toBe(
        true,
      );
    } finally {
      await Promise.all([ormA.close(true), ormB.close(true), ormC.close(true)]);
    }
  });
});
