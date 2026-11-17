import { Money } from '../money/money';
import { LedgerEntry } from './ledger-entry';

describe('LedgerEntry', () => {
  it('should create a valid debit entry', () => {
    const entry = LedgerEntry.create({
      walletId: 'wallet-1',
      transactionId: 'transaction-1',
      direction: 'DEBIT',
      amount: Money.from('20.00', 'BRL'),
      balanceBefore: Money.from('100.00', 'BRL'),
      balanceAfter: Money.from('80.00', 'BRL'),
    });

    expect(entry.entryId).toBeDefined();
    expect(entry.wallet).toBe('wallet-1');
    expect(entry.transaction).toBe('transaction-1');
    expect(entry.entryDirection).toBe('DEBIT');
    expect(entry.value.amount).toBe('20.00');
    expect(entry.previousBalance.amount).toBe('100.00');
    expect(entry.resultingBalance.amount).toBe('80.00');
  });

  it('should create a valid credit entry', () => {
    const entry = LedgerEntry.create({
      walletId: 'wallet-1',
      transactionId: 'transaction-1',
      direction: 'CREDIT',
      amount: Money.from('50.00', 'BRL'),
      balanceBefore: Money.from('80.00', 'BRL'),
      balanceAfter: Money.from('130.00', 'BRL'),
    });

    expect(entry.entryDirection).toBe('CREDIT');
    expect(entry.resultingBalance.amount).toBe('130.00');
  });

  it('should reject an empty wallet id', () => {
    expect(() =>
      LedgerEntry.create({
        walletId: '',
        transactionId: 'transaction-1',
        direction: 'DEBIT',
        amount: Money.from('10.00', 'BRL'),
        balanceBefore: Money.from('100.00', 'BRL'),
        balanceAfter: Money.from('90.00', 'BRL'),
      }),
    ).toThrow('LedgerEntry walletId cannot be empty');
  });

  it('should reject an empty transaction id', () => {
    expect(() =>
      LedgerEntry.create({
        walletId: 'wallet-1',
        transactionId: '',
        direction: 'DEBIT',
        amount: Money.from('10.00', 'BRL'),
        balanceBefore: Money.from('100.00', 'BRL'),
        balanceAfter: Money.from('90.00', 'BRL'),
      }),
    ).toThrow('LedgerEntry transactionId cannot be empty');
  });

  it('should reject zero amount', () => {
    expect(() =>
      LedgerEntry.create({
        walletId: 'wallet-1',
        transactionId: 'transaction-1',
        direction: 'DEBIT',
        amount: Money.from('0.00', 'BRL'),
        balanceBefore: Money.from('100.00', 'BRL'),
        balanceAfter: Money.from('100.00', 'BRL'),
      }),
    ).toThrow('LedgerEntry amount must be greater than zero');
  });

  it('should reject an invalid direction', () => {
    expect(() =>
      LedgerEntry.create({
        walletId: 'wallet-1',
        transactionId: 'transaction-1',
        direction: 'INVALID' as never,
        amount: Money.from('10.00', 'BRL'),
        balanceBefore: Money.from('100.00', 'BRL'),
        balanceAfter: Money.from('90.00', 'BRL'),
      }),
    ).toThrow('Invalid LedgerEntry direction: INVALID');
  });

  it('should reject mismatched currencies', () => {
    expect(() =>
      LedgerEntry.create({
        walletId: 'wallet-1',
        transactionId: 'transaction-1',
        direction: 'DEBIT',
        amount: Money.from('10.00', 'BRL'),
        balanceBefore: Money.from('100.00', 'USD'),
        balanceAfter: Money.from('90.00', 'USD'),
      }),
    ).toThrow(
      'LedgerEntry money values must use the same currency',
    );
  });

  it('should reject an invalid debit balance transition', () => {
    expect(() =>
      LedgerEntry.create({
        walletId: 'wallet-1',
        transactionId: 'transaction-1',
        direction: 'DEBIT',
        amount: Money.from('20.00', 'BRL'),
        balanceBefore: Money.from('100.00', 'BRL'),
        balanceAfter: Money.from('90.00', 'BRL'),
      }),
    ).toThrow('LedgerEntry balance transition is invalid');
  });

  it('should reject an invalid credit balance transition', () => {
    expect(() =>
      LedgerEntry.create({
        walletId: 'wallet-1',
        transactionId: 'transaction-1',
        direction: 'CREDIT',
        amount: Money.from('20.00', 'BRL'),
        balanceBefore: Money.from('100.00', 'BRL'),
        balanceAfter: Money.from('110.00', 'BRL'),
      }),
    ).toThrow('LedgerEntry balance transition is invalid');
  });

  it('should reject a debit that would make the balance negative', () => {
    expect(() =>
      LedgerEntry.create({
        walletId: 'wallet-1',
        transactionId: 'transaction-1',
        direction: 'DEBIT',
        amount: Money.from('120.00', 'BRL'),
        balanceBefore: Money.from('100.00', 'BRL'),
        balanceAfter: Money.from('0.00', 'BRL'),
      }),
    ).toThrow('Money result cannot be negative');
  });

  it('should restore an existing entry', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    const entry = LedgerEntry.restore({
      id: 'ledger-1',
      walletId: 'wallet-1',
      transactionId: 'transaction-1',
      direction: 'CREDIT',
      amount: Money.from('50.00', 'BRL'),
      balanceBefore: Money.from('100.00', 'BRL'),
      balanceAfter: Money.from('150.00', 'BRL'),
      createdAt,
    });

    expect(entry.entryId).toBe('ledger-1');
    expect(entry.creationDate).toEqual(createdAt);
    expect(entry.resultingBalance.amount).toBe('150.00');
  });

  it('should reject restore with an empty id', () => {
    expect(() =>
      LedgerEntry.restore({
        id: '',
        walletId: 'wallet-1',
        transactionId: 'transaction-1',
        direction: 'CREDIT',
        amount: Money.from('50.00', 'BRL'),
        balanceBefore: Money.from('100.00', 'BRL'),
        balanceAfter: Money.from('150.00', 'BRL'),
        createdAt: new Date(),
      }),
    ).toThrow('LedgerEntry id cannot be empty');
  });
});