import { Money } from '../money/money';
import { Wallet } from './wallet';

describe('Wallet', () => {
  it('should create a wallet with the initial values', () => {
    const balance = Money.from('100.00', 'BRL');

    const wallet = Wallet.create('player-1', balance);

    expect(wallet.walletId).toBeDefined();
    expect(wallet.walletId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(wallet.ownerId).toBe('player-1');
    expect(wallet.currentBalance.amount).toBe('100.00');
    expect(wallet.currentBalance.currencyCode).toBe('BRL');
  });

  it('should start with version 1', () => {
    const wallet = Wallet.create('player-1', Money.from('100.00', 'BRL'));

    expect(wallet.currentVersion).toBe(1);
  });

  it('should credit the wallet', () => {
    const wallet = Wallet.create('player-1', Money.from('100.00', 'BRL'));

    wallet.credit(Money.from('50.00', 'BRL'));

    expect(wallet.currentBalance.amount).toBe('150.00');
  });

  it('should debit the wallet', () => {
    const wallet = Wallet.create('player-1', Money.from('100.00', 'BRL'));

    wallet.debit(Money.from('40.00', 'BRL'));

    expect(wallet.currentBalance.amount).toBe('60.00');
  });

  it('should reject a debit that would make the balance negative', () => {
    const wallet = Wallet.create('player-1', Money.from('100.00', 'BRL'));

    expect(() => {
      wallet.debit(Money.from('150.00', 'BRL'));
    }).toThrow();

    expect(wallet.currentBalance.amount).toBe('100.00');
  });

  it('should reject an empty player id', () => {
    expect(() => {
      Wallet.create('', Money.from('100.00', 'BRL'));
    }).toThrow('Wallet playerId cannot be empty');
  });

  it('should reject a credit with a different currency', () => {
    const wallet = Wallet.create('player-1', Money.from('100.00', 'BRL'));

    expect(() => {
      wallet.credit(Money.from('50.00', 'USD'));
    }).toThrow('Currency mismatch: BRL and USD');

    expect(wallet.currentBalance.amount).toBe('100.00');
  });

  describe('restore', () => {
    it('should restore a wallet with its existing identity and version', () => {
      const wallet = Wallet.restore(
        '550e8400-e29b-41d4-a716-446655440000',
        'player-123',
        Money.from('150.00', 'BRL'),
        7,
      );

      expect(wallet.walletId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(wallet.ownerId).toBe('player-123');
      expect(wallet.currentBalance.amount).toBe('150.00');
      expect(wallet.currentBalance.currencyCode).toBe('BRL');
      expect(wallet.currentVersion).toBe(7);
    });

    it('should reject an empty id', () => {
      expect(() =>
        Wallet.restore('', 'player-123', Money.from('150.00', 'BRL'), 1),
      ).toThrow('Wallet id cannot be empty');
    });

    it('should reject an invalid version', () => {
      expect(() =>
        Wallet.restore(
          '550e8400-e29b-41d4-a716-446655440000',
          'player-123',
          Money.from('150.00', 'BRL'),
          0,
        ),
      ).toThrow('Wallet version must be greater than or equal to 1');
    });
  });
});
