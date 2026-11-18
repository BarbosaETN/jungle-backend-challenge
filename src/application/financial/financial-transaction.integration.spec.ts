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

  it('should rollback the entire operation when balance is insufficient', async () => {
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

    const financialService = new FinancialTransactionService(
      databaseTransaction,
      idempotencyService,
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

    await expect(
      financialService.create(request, payloadHash),
    ).rejects.toThrow();

    const verificationEm = orm.em.fork();

    const savedWallet = await verificationEm.findOne(WalletEntity, {
      id: wallet.walletId,
    });

    const savedTransaction = await verificationEm.findOne(
      WagerTransactionEntity,
      { idempotencyKey: request.idempotencyKey },
    );

    const savedLedger = await verificationEm.findOne(LedgerEntryEntity, {
      wallet: wallet.walletId,
    });

    const savedOutbox = await verificationEm.findOne(OutboxMessageEntity, {
      aggregateId: wallet.walletId,
    });

    expect(savedWallet?.balance).toBe('20.00');
    expect(savedWallet?.version).toBe(1);

    expect(savedTransaction).toBeNull();
    expect(savedLedger).toBeNull();
    expect(savedOutbox).toBeNull();
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

    const financialService = new FinancialTransactionService(
      databaseTransaction,
      idempotencyService,
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

  it('should reject a different payload using the same idempotency key', async () => {
    const wallet = Wallet.create(
      'player-conflict',
      Money.from('100.00', 'BRL'),
    );

    const walletRepository = new MikroOrmWalletRepository(orm.em.fork());

    await walletRepository.save(wallet);

    const databaseTransaction = new MikroOrmDatabaseTransaction(orm.em.fork());

    const idempotencyRepository = new MikroOrmWagerTransactionRepository(
      orm.em.fork(),
    );

    const idempotencyService = new IdempotencyService(idempotencyRepository);

    const financialService = new FinancialTransactionService(
      databaseTransaction,
      idempotencyService,
    );

    const request: FinancialTransactionRequest = {
      providerId: 'provider-conflict',
      externalTransactionId: 'external-conflict-1',
      idempotencyKey: 'idempotency-conflict',
      playerId: 'player-conflict',
      walletId: wallet.walletId,
      roundId: 'round-conflict',
      gameId: 'game-conflict',
      amount: '30.00',
      currency: 'BRL',
      kind: 'BET',
    };

    const firstHash = 'd'.repeat(64);
    const secondHash = 'e'.repeat(64);

    const firstResult = await financialService.create(request, firstHash);

    expect(firstResult.replayed).toBe(false);

    const conflictingRequest = {
      ...request,
      externalTransactionId: 'external-conflict-2',
      amount: '50.00',
    };

    await expect(
      financialService.create(conflictingRequest, secondHash),
    ).rejects.toThrow();

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

    const financialService = new FinancialTransactionService(
      databaseTransaction,
      idempotencyService,
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

      return new FinancialTransactionService(
        databaseTransaction,
        idempotencyService,
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
});
