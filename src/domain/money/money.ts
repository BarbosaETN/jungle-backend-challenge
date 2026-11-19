import Decimal from 'decimal.js';
import { CURRENCIES, Currency } from './currency';
import { MoneyError } from './money.errors';

export class Money {
  private constructor(
    private readonly value: Decimal,
    private readonly currency: Currency,
  ) {}

  static from(amount: string, currency: Currency): Money {
    if (!amount.trim()) {
      throw new MoneyError('Money amount cannot be empty');
    }

    const decimal = new Decimal(amount);

    if (decimal.decimalPlaces() > 2) {
      throw new MoneyError(
        'Money amount cannot have more than 2 decimal places',
      );
    }

    if (decimal.isNegative()) {
      throw new MoneyError('Money amount cannot be negative');
    }

    if (!CURRENCIES.includes(currency)) {
      throw new MoneyError(`Unsupported currency: ${currency}`);
    }

    return new Money(decimal, currency);
  }

  get amount(): string {
    return this.value.toFixed(2);
  }

  get currencyCode(): Currency {
    return this.currency;
  }

  private ensureSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyError(
        `Currency mismatch: ${this.currency} and ${other.currency}`,
      );
    }
  }

  add(other: Money): Money {
    this.ensureSameCurrency(other);

    const result = this.value.plus(other.value);

    return new Money(result, this.currency);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);

    const result = this.value.minus(other.value);

    if (result.isNegative()) {
      throw new MoneyError('Money result cannot be negative');
    }

    return new Money(result, this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.value.equals(other.value);
  }

  isGreaterThanOrEqual(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.value.greaterThanOrEqualTo(other.value);
  }
}
