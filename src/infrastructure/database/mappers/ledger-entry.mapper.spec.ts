import { Money } from '../../../domain/money/money';
import { LedgerEntry } from '../../../domain/ledger/ledger-entry';
import { LedgerEntryEntity } from '../entities/ledger-entry.entity';
import { LedgerEntryMapper } from './ledger-entry.mapper';

describe('LedgerEntryMapper', () => {
  const walletId = '550e8400-e29b-41d4-a716-446655440000';
  const transactionId = '550e8400-e29b-41d4-a716-446655440001';
  const entryId = '550e8400-e29b-41d4-a716-446655440002';

  it('should map entity to domain', () => {
    const entity = new LedgerEntryEntity();

    entity.id = entryId;
    entity.wallet = {
      id: walletId,
    } as LedgerEntryEntity['wallet'];
    entity.transaction = {
      id: transactionId,
    } as LedgerEntryEntity['transaction'];
    entity.direction = 'DEBIT';
    entity.amount = '25.00';
    entity.currency = 'BRL';
    entity.balanceBefore = '100.00';
    entity.balanceAfter = '75.00';
    entity.createdAt = new Date('2026-11-17T20:00:00.000Z');

    const domain = LedgerEntryMapper.toDomain(entity);

    expect(domain.entryId).toBe(entryId);
    expect(domain.wallet).toBe(walletId);
    expect(domain.transaction).toBe(transactionId);
    expect(domain.entryDirection).toBe('DEBIT');
    expect(domain.value.amount).toBe('25.00');
    expect(domain.value.currencyCode).toBe('BRL');
    expect(domain.previousBalance.amount).toBe('100.00');
    expect(domain.resultingBalance.amount).toBe('75.00');
    expect(domain.creationDate).toEqual(
      new Date('2026-11-17T20:00:00.000Z'),
    );
  });

  it('should map domain to entity', () => {
    const amount = Money.from('25.00', 'BRL');
    const balanceBefore = Money.from('100.00', 'BRL');
    const balanceAfter = Money.from('75.00', 'BRL');

    const createdAt = new Date('2026-11-17T20:00:00.000Z');

    const domain = LedgerEntry.restore({
      id: entryId,
      walletId,
      transactionId,
      direction: 'DEBIT',
      amount,
      balanceBefore,
      balanceAfter,
      createdAt,
    });

    const wallet = {
      id: walletId,
    } as LedgerEntryEntity['wallet'];

    const transaction = {
      id: transactionId,
    } as LedgerEntryEntity['transaction'];

    const entity = LedgerEntryMapper.toEntity(
      domain,
      wallet,
      transaction,
    );

    expect(entity.id).toBe(entryId);
    expect(entity.wallet).toBe(wallet);
    expect(entity.transaction).toBe(transaction);
    expect(entity.direction).toBe('DEBIT');
    expect(entity.amount).toBe('25.00');
    expect(entity.currency).toBe('BRL');
    expect(entity.balanceBefore).toBe('100.00');
    expect(entity.balanceAfter).toBe('75.00');
    expect(entity.createdAt).toEqual(createdAt);
  });

  it('should preserve credit entries', () => {
    const amount = Money.from('50.00', 'BRL');
    const balanceBefore = Money.from('100.00', 'BRL');
    const balanceAfter = Money.from('150.00', 'BRL');

    const domain = LedgerEntry.restore({
      id: entryId,
      walletId,
      transactionId,
      direction: 'CREDIT',
      amount,
      balanceBefore,
      balanceAfter,
      createdAt: new Date(),
    });

    const wallet = {
      id: walletId,
    } as LedgerEntryEntity['wallet'];

    const transaction = {
      id: transactionId,
    } as LedgerEntryEntity['transaction'];

    const entity = LedgerEntryMapper.toEntity(
      domain,
      wallet,
      transaction,
    );

    expect(entity.direction).toBe('CREDIT');
    expect(entity.amount).toBe('50.00');
    expect(entity.balanceBefore).toBe('100.00');
    expect(entity.balanceAfter).toBe('150.00');
  });
});