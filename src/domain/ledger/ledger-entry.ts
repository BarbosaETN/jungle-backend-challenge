import { randomUUID } from 'node:crypto';

import { Money } from '../money/money';

import {
  LEDGER_ENTRY_DIRECTIONS,
} from './ledger-entry-direction';

import type {
  LedgerEntryDirection,
} from './ledger-entry-direction';

import { LedgerEntryError } from './ledger-entry.errors';

import type {
  CreateLedgerEntryInput,
  RestoreLedgerEntryInput,
} from './ledger-entry.types';

export class LedgerEntry {
  private constructor(
    private readonly id: string,
    private readonly walletId: string,
    private readonly transactionId: string,
    private readonly direction: LedgerEntryDirection,
    private readonly amount: Money,
    private readonly balanceBefore: Money,
    private readonly balanceAfter: Money,
    private readonly createdAt: Date,
  ) {}

  static create(input: CreateLedgerEntryInput): LedgerEntry {
    LedgerEntry.validateRequiredFields(input);
    LedgerEntry.validateBalanceTransition(input);

    return new LedgerEntry(
      randomUUID(),
      input.walletId,
      input.transactionId,
      input.direction,
      input.amount,
      input.balanceBefore,
      input.balanceAfter,
      new Date(),
    );
  }

  static restore(input: RestoreLedgerEntryInput): LedgerEntry {
    if (!input.id.trim()) {
      throw new LedgerEntryError(
        'LedgerEntry id cannot be empty',
      );
    }

    LedgerEntry.validateRequiredFields(input);
    LedgerEntry.validateBalanceTransition(input);

    return new LedgerEntry(
      input.id,
      input.walletId,
      input.transactionId,
      input.direction,
      input.amount,
      input.balanceBefore,
      input.balanceAfter,
      input.createdAt,
    );
  }

  private static validateRequiredFields(
    input: CreateLedgerEntryInput,
  ): void {
    const fields = {
      walletId: input.walletId,
      transactionId: input.transactionId,
    };

    for (const [field, value] of Object.entries(fields)) {
      if (!value.trim()) {
        throw new LedgerEntryError(
          `LedgerEntry ${field} cannot be empty`,
        );
      }
    }

    if (!(input.amount instanceof Money)) {
      throw new LedgerEntryError(
        'LedgerEntry amount must be a Money instance',
      );
    }

    if (!(input.balanceBefore instanceof Money)) {
      throw new LedgerEntryError(
        'LedgerEntry balanceBefore must be a Money instance',
      );
    }

    if (!(input.balanceAfter instanceof Money)) {
      throw new LedgerEntryError(
        'LedgerEntry balanceAfter must be a Money instance',
      );
    }

    if (!LEDGER_ENTRY_DIRECTIONS.includes(input.direction)) {
      throw new LedgerEntryError(
        `Invalid LedgerEntry direction: ${input.direction}`,
      );
    }

    if (input.amount.amount === '0.00') {
      throw new LedgerEntryError(
        'LedgerEntry amount must be greater than zero',
      );
    }
  }

  private static validateBalanceTransition(
    input: CreateLedgerEntryInput,
  ): void {
    if (
      input.amount.currencyCode !==
        input.balanceBefore.currencyCode ||
      input.amount.currencyCode !==
        input.balanceAfter.currencyCode
    ) {
      throw new LedgerEntryError(
        'LedgerEntry money values must use the same currency',
      );
    }

    const expectedBalance =
      input.direction === 'DEBIT'
        ? input.balanceBefore.subtract(input.amount)
        : input.balanceBefore.add(input.amount);

    if (!expectedBalance.equals(input.balanceAfter)) {
      throw new LedgerEntryError(
        'LedgerEntry balance transition is invalid',
      );
    }
  }

  get entryId(): string {
    return this.id;
  }

  get wallet(): string {
    return this.walletId;
  }

  get transaction(): string {
    return this.transactionId;
  }

  get entryDirection(): LedgerEntryDirection {
    return this.direction;
  }

  get value(): Money {
    return this.amount;
  }

  get previousBalance(): Money {
    return this.balanceBefore;
  }

  get resultingBalance(): Money {
    return this.balanceAfter;
  }

  get creationDate(): Date {
    return this.createdAt;
  }
}