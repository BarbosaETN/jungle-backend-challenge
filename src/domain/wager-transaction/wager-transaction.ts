import { randomUUID } from 'node:crypto';

import { Money } from '../money/money';

import { WAGER_TRANSACTION_KINDS } from './wager-transaction-kind';

import type { WagerTransactionKind } from './wager-transaction-kind';

import { WAGER_TRANSACTION_STATUSES } from './wager-transaction-status';

import type { WagerTransactionStatus } from './wager-transaction-status';

import { WagerTransactionError } from './wager-transaction.errors';

import type {
  CreateWagerTransactionInput,
  RestoreWagerTransactionInput,
} from './wager-transaction.types';

export class WagerTransaction {
  private constructor(
    private readonly id: string,
    private readonly providerId: string,
    private readonly externalTransactionId: string,
    private readonly idempotencyKey: string,
    private readonly payloadHash: string,
    private readonly walletId: string,
    private readonly playerId: string,
    private readonly roundId: string,
    private readonly gameId: string,
    private readonly amount: Money,
    private readonly kind: WagerTransactionKind,
    private status: WagerTransactionStatus,
    private readonly referenceExternalTransactionId?: string,
    private readonly referenceTransactionId?: string,
    private failureCode?: string,
    private processedAt?: Date,
    private readonly createdAt: Date = new Date(),
  ) {}

  static create(input: CreateWagerTransactionInput): WagerTransaction {
    WagerTransaction.validateRequiredFields(input);

    return new WagerTransaction(
      randomUUID(),
      input.providerId,
      input.externalTransactionId,
      input.idempotencyKey,
      input.payloadHash,
      input.walletId,
      input.playerId,
      input.roundId,
      input.gameId,
      input.amount,
      input.kind,
      'PENDING',
      input.referenceExternalTransactionId,
      input.referenceTransactionId,
    );
  }

  static restore(input: RestoreWagerTransactionInput): WagerTransaction {
    if (!input.id.trim()) {
      throw new WagerTransactionError('WagerTransaction id cannot be empty');
    }

    WagerTransaction.validateRequiredFields(input);

    if (!WAGER_TRANSACTION_STATUSES.includes(input.status)) {
      throw new WagerTransactionError(
        `Invalid WagerTransaction status: ${input.status}`,
      );
    }

    return new WagerTransaction(
      input.id,
      input.providerId,
      input.externalTransactionId,
      input.idempotencyKey,
      input.payloadHash,
      input.walletId,
      input.playerId,
      input.roundId,
      input.gameId,
      input.amount,
      input.kind,
      input.status,
      input.referenceExternalTransactionId,
      input.referenceTransactionId,
      input.failureCode,
      input.processedAt,
      input.createdAt,
    );
  }

  private static validateRequiredFields(
    input: CreateWagerTransactionInput,
  ): void {
    const fields = {
      providerId: input.providerId,
      externalTransactionId: input.externalTransactionId,
      idempotencyKey: input.idempotencyKey,
      payloadHash: input.payloadHash,
      walletId: input.walletId,
      playerId: input.playerId,
      roundId: input.roundId,
      gameId: input.gameId,
    };

    for (const [field, value] of Object.entries(fields)) {
      if (!value.trim()) {
        throw new WagerTransactionError(
          `WagerTransaction ${field} cannot be empty`,
        );
      }
    }

    if (!(input.amount instanceof Money)) {
      throw new WagerTransactionError(
        'WagerTransaction amount must be a Money instance',
      );
    }

    if (input.amount.amount === '0.00') {
      throw new WagerTransactionError(
        'WagerTransaction amount must be greater than zero',
      );
    }

    if (!WAGER_TRANSACTION_KINDS.includes(input.kind)) {
      throw new WagerTransactionError(
        `Invalid WagerTransaction kind: ${input.kind}`,
      );
    }
  }

  markPendingReference(): void {
    this.status = 'PENDING_REFERENCE';
  }

  markPending(): void {
    this.status = 'PENDING';
  }

  markRejected(failureCode: string): void {
    if (!failureCode.trim()) {
      throw new WagerTransactionError(
        'WagerTransaction failureCode cannot be empty',
      );
    }

    this.status = 'REJECTED';
    this.failureCode = failureCode;
  }

  get transactionId(): string {
    return this.id;
  }

  get provider(): string {
    return this.providerId;
  }

  get externalId(): string {
    return this.externalTransactionId;
  }

  get idempotency(): string {
    return this.idempotencyKey;
  }

  get hash(): string {
    return this.payloadHash;
  }

  get wallet(): string {
    return this.walletId;
  }

  get player(): string {
    return this.playerId;
  }

  get round(): string {
    return this.roundId;
  }

  get game(): string {
    return this.gameId;
  }

  get value(): Money {
    return this.amount;
  }

  get transactionKind(): WagerTransactionKind {
    return this.kind;
  }

  get currentStatus(): WagerTransactionStatus {
    return this.status;
  }

  get referenceExternalId(): string | undefined {
    return this.referenceExternalTransactionId;
  }

  get referenceId(): string | undefined {
    return this.referenceTransactionId;
  }

  get errorCode(): string | undefined {
    return this.failureCode;
  }

  get processedDate(): Date | undefined {
    return this.processedAt;
  }

  get creationDate(): Date {
    return this.createdAt;
  }
}
