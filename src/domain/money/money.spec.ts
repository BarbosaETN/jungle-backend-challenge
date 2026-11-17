import { Money } from './money';

describe('Money', () => {
  it('should create a valid money value', () => {
    const money = Money.from('100.50', 'BRL');

    expect(money.amount).toBe('100.50');
    expect(money.currencyCode).toBe('BRL');
  });

  it('should reject an empty amount', () => {
    expect(() => Money.from('', 'BRL')).toThrow('Money amount cannot be empty');
  });

  it('should reject amounts with more than two decimal places', () => {
    expect(() => Money.from('100.999', 'BRL')).toThrow(
      'Money amount cannot have more than 2 decimal places',
    );
  });

  it('should reject negative amounts', () => {
    expect(() => Money.from('-10.00', 'BRL')).toThrow(
      'Money amount cannot be negative',
    );
  });

  it('should reject an unsupported currency', () => {
    expect(() => Money.from('100.00', 'GBP' as never)).toThrow(
      'Unsupported currency: GBP',
    );
  });

  it('should add two money values with the same currency', () => {
    const balance = Money.from('100.00', 'BRL');
    const amount = Money.from('20.50', 'BRL');

    const result = balance.add(amount);

    expect(result.amount).toBe('120.50');
    expect(result.currencyCode).toBe('BRL');
  });

  it('should reject adding money values with different currencies', () => {
    const brl = Money.from('100.00', 'BRL');
    const usd = Money.from('20.00', 'USD');

    expect(() => brl.add(usd)).toThrow('Currency mismatch: BRL and USD');
  });

  it('should not mutate the original money values when adding', () => {
    const balance = Money.from('100.00', 'BRL');
    const amount = Money.from('20.50', 'BRL');

    balance.add(amount);

    expect(balance.amount).toBe('100.00');
    expect(amount.amount).toBe('20.50');
  });

  it('should subtract two money values with the same currency', () => {
    const balance = Money.from('100.00', 'BRL');
    const amount = Money.from('20.50', 'BRL');

    const result = balance.subtract(amount);

    expect(result.amount).toBe('79.50');
    expect(result.currencyCode).toBe('BRL');
  });

  it('should allow subtracting the entire amount', () => {
    const balance = Money.from('100.00', 'BRL');
    const amount = Money.from('100.00', 'BRL');

    const result = balance.subtract(amount);

    expect(result.amount).toBe('0.00');
  });

  it('should reject subtraction resulting in a negative amount', () => {
    const balance = Money.from('100.00', 'BRL');
    const amount = Money.from('120.00', 'BRL');

    expect(() => balance.subtract(amount)).toThrow(
      'Money result cannot be negative',
    );
  });

  it('should reject subtracting money values with different currencies', () => {
    const brl = Money.from('100.00', 'BRL');
    const usd = Money.from('20.00', 'USD');

    expect(() => brl.subtract(usd)).toThrow('Currency mismatch: BRL and USD');
  });

  it('should consider money values with the same amount and currency equal', () => {
    const first = Money.from('100.00', 'BRL');
    const second = Money.from('100.00', 'BRL');

    expect(first.equals(second)).toBe(true);
  });

  it('should not consider money values with different amounts equal', () => {
    const first = Money.from('100.00', 'BRL');
    const second = Money.from('100.01', 'BRL');

    expect(first.equals(second)).toBe(false);
  });

  it('should not consider money values with different currencies equal', () => {
    const brl = Money.from('100.00', 'BRL');
    const usd = Money.from('100.00', 'USD');

    expect(brl.equals(usd)).toBe(false);
  });
});
