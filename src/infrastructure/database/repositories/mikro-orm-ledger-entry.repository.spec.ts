import { MikroORM } from '@mikro-orm/postgresql';

import { Money } from '../../../domain/money/money';
import { LedgerEntry } from '../../../domain/ledger/ledger-entry';
import { WagerTransaction } from '../../../domain/wager-transaction/wager-transaction';

import { LedgerEntryEntity } from '../entities/ledger-entry.entity';
import { WalletEntity } from '../entities/wallet.entity';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';

import { MikroOrmLedgerEntryRepository } from './mikro-orm-ledger-entry.repository';

import mikroOrmConfig from '../mikro-orm.config';

describe('MikroOrmLedgerEntryRepository', () => {
  let orm: MikroORM;
  let repository: MikroOrmLedgerEntryRepository;
  let em: ReturnType<MikroORM['em']['fork']>;

  beforeAll(async () => {
    orm = await MikroORM.init(mikroOrmConfig);

    em = orm.em.fork();

    repository = new MikroOrmLedgerEntryRepository(em);
  });

  afterAll(async () => {
    await orm.close(true);
  });

  beforeEach(async () => {
    em.clear();

    await em.nativeDelete(LedgerEntryEntity, {});
    await em.nativeDelete(WagerTransactionEntity, {});
    await em.nativeDelete(WalletEntity, {});

    em.clear();
  });

  async function createWallet(): Promise<WalletEntity> {
    const wallet = new WalletEntity();

    wallet.id = crypto.randomUUID();
    wallet.playerId = 'player-1';
    wallet.balance = '100.00';
    wallet.currency = 'BRL';
    wallet.version = 1;

    em.persist(wallet);
    await em.flush();

    return wallet;
  }

  async function createTransaction(
    wallet: WalletEntity,
    suffix = '1',
  ): Promise<WagerTransactionEntity> {
    const transaction = WagerTransaction.create({
      providerId: `provider-${suffix}`,
      externalTransactionId: `external-${suffix}`,
      idempotencyKey: `idem-${suffix}`,
      payloadHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      walletId: wallet.id,
      playerId: wallet.playerId,
      roundId: `round-${suffix}`,
      gameId: `game-${suffix}`,
      amount: Money.from('25.00', 'BRL'),
      kind: 'BET',
    });

    const transactionEntity = new WagerTransactionEntity();

    transactionEntity.id = transaction.transactionId;
    transactionEntity.providerId = transaction.provider;
    transactionEntity.externalTransactionId = transaction.externalId;
    transactionEntity.idempotencyKey = transaction.idempotency;
    transactionEntity.payloadHash = transaction.hash;
    transactionEntity.wallet = wallet;
    transactionEntity.playerId = transaction.player;
    transactionEntity.roundId = transaction.round;
    transactionEntity.gameId = transaction.game;
    transactionEntity.amount = transaction.value.amount;
    transactionEntity.currency = transaction.value.currencyCode;
    transactionEntity.kind = transaction.transactionKind;
    transactionEntity.status = transaction.currentStatus;
    transactionEntity.createdAt = transaction.creationDate;

    em.persist(transactionEntity);
    await em.flush();

    return transactionEntity;
  }

  function createDebitEntry(
    wallet: WalletEntity,
    transaction: WagerTransactionEntity,
  ): LedgerEntry {
    return LedgerEntry.create({
      walletId: wallet.id,
      transactionId: transaction.id,
      direction: 'DEBIT',
      amount: Money.from('25.00', 'BRL'),
      balanceBefore: Money.from('100.00', 'BRL'),
      balanceAfter: Money.from('75.00', 'BRL'),
    });
  }

  it('should save and find a ledger entry by id', async () => {
    const wallet = await createWallet();
    const transaction = await createTransaction(wallet);

    const entry = createDebitEntry(wallet, transaction);

    await repository.save(entry);

    const found = await repository.findById(entry.entryId);

    expect(found).not.toBeNull();
    expect(found?.entryId).toBe(entry.entryId);
    expect(found?.wallet).toBe(wallet.id);
    expect(found?.transaction).toBe(transaction.id);
    expect(found?.entryDirection).toBe('DEBIT');
    expect(found?.value.amount).toBe('25.00');
    expect(found?.value.currencyCode).toBe('BRL');
    expect(found?.previousBalance.amount).toBe('100.00');
    expect(found?.resultingBalance.amount).toBe('75.00');
  });

  it('should find a ledger entry by transaction id', async () => {
    const wallet = await createWallet();
    const transaction = await createTransaction(wallet);

    const entry = createDebitEntry(wallet, transaction);

    await repository.save(entry);

    const found = await repository.findByTransactionId(transaction.id);

    expect(found).not.toBeNull();
    expect(found?.entryId).toBe(entry.entryId);
    expect(found?.transaction).toBe(transaction.id);
    expect(found?.wallet).toBe(wallet.id);
  });

  it('should return null when the ledger entry does not exist', async () => {
    const found = await repository.findById(crypto.randomUUID());

    expect(found).toBeNull();
  });

  it('should reject a ledger entry when the wallet does not exist', async () => {
    const walletId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();

    const entry = LedgerEntry.create({
      walletId,
      transactionId,
      direction: 'DEBIT',
      amount: Money.from('25.00', 'BRL'),
      balanceBefore: Money.from('100.00', 'BRL'),
      balanceAfter: Money.from('75.00', 'BRL'),
    });

    await expect(repository.save(entry)).rejects.toThrow(
      `Wallet not found: ${walletId}`,
    );
  });

  it('should reject a ledger entry when the transaction does not exist', async () => {
    const wallet = await createWallet();
    const transactionId = crypto.randomUUID();

    const entry = LedgerEntry.create({
      walletId: wallet.id,
      transactionId,
      direction: 'DEBIT',
      amount: Money.from('25.00', 'BRL'),
      balanceBefore: Money.from('100.00', 'BRL'),
      balanceAfter: Money.from('75.00', 'BRL'),
    });

    await expect(repository.save(entry)).rejects.toThrow(
      `WagerTransaction not found: ${transactionId}`,
    );
  });

  it('should reject duplicate ledger entries for the same transaction and wallet', async () => {
    const wallet = await createWallet();
    const transaction = await createTransaction(wallet);

    const firstEntry = createDebitEntry(wallet, transaction);

    await repository.save(firstEntry);

    const secondEntry = LedgerEntry.create({
      walletId: wallet.id,
      transactionId: transaction.id,
      direction: 'DEBIT',
      amount: Money.from('25.00', 'BRL'),
      balanceBefore: Money.from('100.00', 'BRL'),
      balanceAfter: Money.from('75.00', 'BRL'),
    });

    await expect(repository.save(secondEntry)).rejects.toThrow();
  });

  it('should reject attempts to update an existing ledger entry', async () => {
    const wallet = await createWallet();
    const transaction = await createTransaction(wallet);

    const entry = createDebitEntry(wallet, transaction);

    await repository.save(entry);

    await expect(repository.save(entry)).rejects.toThrow(
      `LedgerEntry cannot be updated: ${entry.entryId}`,
    );
  });
});
