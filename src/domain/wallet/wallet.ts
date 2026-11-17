import { Money } from '../money/money';
import { randomUUID } from 'node:crypto';
import { WalletError } from './wallet.errors';

export class Wallet {
  private constructor(
    private readonly id: string,
    private readonly playerId: string,
    private balance: Money,
    private version: number,
  ) {}

  static create(playerId: string, balance: Money): Wallet {
    if (!playerId.trim()) {
      throw new WalletError('Wallet playerId cannot be empty');
    }

    return new Wallet(randomUUID(), playerId, balance, 1);
  }

  static restore(
    id: string,
    playerId: string,
    balance: Money,
    version: number,
  ): Wallet {
    if (!id.trim()) {
      throw new WalletError('Wallet id cannot be empty');
    }

    if (!playerId.trim()) {
      throw new WalletError('Wallet playerId cannot be empty');
    }

    if (version < 1) {
      throw new WalletError(
        'Wallet version must be greater than or equal to 1',
      );
    }

    return new Wallet(id, playerId, balance, version);
  }

  get walletId(): string {
    return this.id;
  }

  get ownerId(): string {
    return this.playerId;
  }

  get currentBalance(): Money {
    return this.balance;
  }

  get currentVersion(): number {
    return this.version;
  }

  credit(amount: Money): void {
    this.balance = this.balance.add(amount);
  }

  debit(amount: Money): void {
    this.balance = this.balance.subtract(amount);
  }
}
