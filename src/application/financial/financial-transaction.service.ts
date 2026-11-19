import { randomUUID } from 'crypto';

import { Money } from '../../domain/money/money';
import { LedgerEntry } from '../../domain/ledger/ledger-entry';
import { WagerTransaction } from '../../domain/wager-transaction/wager-transaction';
import { OutboxMessage } from '../../domain/outbox/outbox-message';
import { WagerTransactionProcessedEvent } from '../../domain/events/wager-transaction-processed.event';
import { WalletBalanceChangedEvent } from '../../domain/events/wallet-balance-changed.event';
import { WagerTransactionPendingReferenceEvent } from '../../domain/events/wager-transaction-pending-reference.event';
import { WagerTransactionRejectedEvent } from '../../domain/events/wager-transaction-rejected.event';
import type { DatabaseTransaction } from '../common/database-transaction';
import { IdempotencyService } from '../idempotency/idempotency.service';

import type { FinancialTransactionRequest } from './financial-transaction.request';
import type { FinancialTransactionResult } from './financial-transaction.result';

import { LoggerService } from '../../infrastructure/observability/logger.service';
import { LOG_EVENTS } from '../../infrastructure/observability/log-events';
import { WalletConcurrencyRetryService } from '../concurrency/wallet-concurrency-retry.service';
import { CorrelationIdService } from '../../infrastructure/observability/correlation-id.service';
import { UniqueConstraintViolationException } from '@mikro-orm/core';

export class FinancialTransactionService {
  constructor(
    private readonly databaseTransaction: DatabaseTransaction,
    private readonly idempotencyService: IdempotencyService,
    private readonly logger: LoggerService,
    private readonly correlationIdService: CorrelationIdService,
    private readonly walletConcurrencyRetryService: WalletConcurrencyRetryService,
  ) {}

  async create(
    request: FinancialTransactionRequest,
    payloadHash: string,
  ): Promise<FinancialTransactionResult> {
    try {
      const result = await this.walletConcurrencyRetryService.execute(() =>
        this.databaseTransaction.run(async (context) => {
          const idempotency = await this.idempotencyService.resolve(
            request.idempotencyKey,
            payloadHash,
            context.wagerTransactionRepository,
          );

          if (idempotency.type === 'REPLAY') {
            return {
              transaction: idempotency.transaction,
              replayed: true,
            };
          }

          if (idempotency.type === 'CONFLICT') {
            throw new Error(
              `Idempotency key conflict: ${request.idempotencyKey}`,
            );
          }

          const wallet = await context.walletRepository.findById(
            request.walletId,
          );

          if (!wallet) {
            throw new Error(`Wallet not found: ${request.walletId}`);
          }

          let referenceTransaction: WagerTransaction | null = null;

          const requiresReference =
            request.kind === 'REFUND' || request.kind === 'ROLLBACK';

          if (requiresReference && !request.referenceExternalTransactionId) {
            throw new Error(
              `${request.kind} requires referenceExternalTransactionId`,
            );
          }

          if (requiresReference && request.referenceExternalTransactionId) {
            referenceTransaction =
              await context.wagerTransactionRepository.findByProviderAndExternalId(
                request.providerId,
                request.referenceExternalTransactionId,
              );

            if (!referenceTransaction) {
              const pendingTransaction = WagerTransaction.create({
                providerId: request.providerId,
                externalTransactionId: request.externalTransactionId,
                idempotencyKey: request.idempotencyKey,
                payloadHash,
                walletId: request.walletId,
                playerId: request.playerId,
                roundId: request.roundId,
                gameId: request.gameId,
                amount: Money.from(request.amount, request.currency),
                kind: request.kind,
                referenceExternalTransactionId:
                  request.referenceExternalTransactionId,
              });

              pendingTransaction.markPendingReference();

              await context.wagerTransactionRepository.save(pendingTransaction);

              const pendingReferenceEvent =
                new WagerTransactionPendingReferenceEvent({
                  eventId: pendingTransaction.transactionId,
                  aggregateId: pendingTransaction.transactionId,
                  correlationId:
                    this.correlationIdService.get() ??
                    pendingTransaction.transactionId,
                  occurredAt: new Date(),
                  data: {
                    transactionId: pendingTransaction.transactionId,
                    walletId: pendingTransaction.wallet,
                    playerId: pendingTransaction.player,
                    externalTransactionId: pendingTransaction.externalId,
                    providerId: pendingTransaction.provider,
                    kind: pendingTransaction.transactionKind,
                    amount: {
                      amount: pendingTransaction.value.amount,
                      currency: pendingTransaction.value.currencyCode,
                    },
                    currency: pendingTransaction.value.currencyCode,
                    referenceExternalTransactionId:
                      pendingTransaction.referenceExternalId!,
                  },
                });

              await context.outboxRepository.save(
                OutboxMessage.enqueue(pendingReferenceEvent),
              );

              return {
                transaction: pendingTransaction,
                replayed: false,
              };
            }

            if (
              request.kind === 'REFUND' &&
              referenceTransaction.transactionKind !== 'BET'
            ) {
              throw new Error(
                `REFUND can only reference a BET, received: ${referenceTransaction.transactionKind}`,
              );
            }
          }

          const transaction = WagerTransaction.create({
            providerId: request.providerId,
            externalTransactionId: request.externalTransactionId,
            idempotencyKey: request.idempotencyKey,
            payloadHash,
            walletId: request.walletId,
            playerId: request.playerId,
            roundId: request.roundId,
            gameId: request.gameId,
            amount: Money.from(request.amount, request.currency),
            kind: request.kind,
            referenceExternalTransactionId:
              request.referenceExternalTransactionId,
            referenceTransactionId: referenceTransaction?.transactionId,
          });

          return this.processTransaction(
            context,
            transaction,
            referenceTransaction,
          );
        }),
      );

      this.logger.info(LOG_EVENTS.TRANSACTION_CREATED, {
        transactionId: result.transaction.transactionId,
        walletId: request.walletId,
        playerId: request.playerId,
        idempotencyKey: request.idempotencyKey,
      });

      return result;
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        const idempotency = await this.idempotencyService.resolve(
          request.idempotencyKey,
          payloadHash,
        );

        if (idempotency.type === 'REPLAY') {
          return {
            transaction: idempotency.transaction,
            replayed: true,
          };
        }

        if (idempotency.type === 'CONFLICT') {
          throw new Error(
            `Idempotency key conflict: ${request.idempotencyKey}`,
          );
        }
      }

      throw error;
    }
  }

  async reprocessPendingReference(
    transaction: WagerTransaction,
  ): Promise<FinancialTransactionResult> {
    const result = await this.walletConcurrencyRetryService.execute(() =>
      this.databaseTransaction.run(async (context) => {
        const referenceExternalTransactionId = transaction.referenceExternalId;

        if (!referenceExternalTransactionId) {
          throw new Error(
            `Pending transaction has no reference: ${transaction.transactionId}`,
          );
        }

        const referenceTransaction =
          await context.wagerTransactionRepository.findByProviderAndExternalId(
            transaction.provider,
            referenceExternalTransactionId,
          );

        if (!referenceTransaction) {
          throw new Error(
            `Reference transaction not found: ${referenceExternalTransactionId}`,
          );
        }

        if (
          transaction.transactionKind === 'REFUND' &&
          referenceTransaction.transactionKind !== 'BET'
        ) {
          throw new Error(
            `REFUND can only reference a BET, received: ${referenceTransaction.transactionKind}`,
          );
        }

        transaction.markPending();

        return this.processTransaction(
          context,
          transaction,
          referenceTransaction,
        );
      }),
    );

    this.logger.info(LOG_EVENTS.TRANSACTION_CREATED, {
      transactionId: result.transaction.transactionId,
      walletId: transaction.wallet,
      playerId: transaction.player,
      idempotencyKey: transaction.idempotency,
    });

    return result;
  }

  private async processTransaction(
    context: Awaited<ReturnType<DatabaseTransaction['run']>> extends never
      ? never
      : Parameters<Parameters<DatabaseTransaction['run']>[0]>[0],
    transaction: WagerTransaction,
    referenceTransaction: WagerTransaction | null,
  ): Promise<FinancialTransactionResult> {
    const wallet = await context.walletRepository.findById(transaction.wallet);

    if (!wallet) {
      throw new Error(`Wallet not found: ${transaction.wallet}`);
    }

    const amount = transaction.value;
    const balanceBefore = wallet.currentBalance;

    let direction: 'DEBIT' | 'CREDIT' | null = null;

    if (transaction.transactionKind === 'BET') {
      direction = 'DEBIT';
    } else if (
      transaction.transactionKind === 'WIN' ||
      transaction.transactionKind === 'REFUND'
    ) {
      direction = 'CREDIT';
    } else if (transaction.transactionKind === 'ROLLBACK') {
      if (!referenceTransaction) {
        throw new Error('ROLLBACK reference transaction not found');
      }

      if (referenceTransaction.transactionKind === 'BET') {
        direction = 'CREDIT';
      } else if (
        referenceTransaction.transactionKind === 'WIN' ||
        referenceTransaction.transactionKind === 'REFUND'
      ) {
        direction = 'DEBIT';
      } else {
        throw new Error(
          `ROLLBACK cannot reference transaction kind: ${referenceTransaction.transactionKind}`,
        );
      }
    }

    if (
      direction === 'DEBIT' &&
      !wallet.currentBalance.isGreaterThanOrEqual(amount)
    ) {
      const failureCode = 'INSUFFICIENT_BALANCE';

      transaction.markRejected(failureCode);

      await context.wagerTransactionRepository.save(transaction);

      const rejectedEvent = new WagerTransactionRejectedEvent({
        eventId: transaction.transactionId,
        aggregateId: transaction.transactionId,
        correlationId:
          this.correlationIdService.get() ?? transaction.transactionId,
        occurredAt: new Date(),
        data: {
          transactionId: transaction.transactionId,
          walletId: wallet.walletId,
          playerId: wallet.ownerId,
          externalTransactionId: transaction.externalId,
          providerId: transaction.provider,
          kind: transaction.transactionKind,
          amount: {
            amount: amount.amount,
            currency: amount.currencyCode,
          },
          currency: amount.currencyCode,
          failureCode,
        },
      });

      await context.outboxRepository.save(OutboxMessage.enqueue(rejectedEvent));

      return {
        transaction,
        replayed: false,
      };
    }

    if (direction === 'CREDIT') {
      wallet.credit(amount);
    } else if (direction === 'DEBIT') {
      wallet.debit(amount);
    }

    const balanceAfter = wallet.currentBalance;

    const ledgerEntry =
      direction === null
        ? null
        : LedgerEntry.create({
            walletId: wallet.walletId,
            transactionId: transaction.transactionId,
            direction,
            amount,
            balanceBefore,
            balanceAfter,
          });

    await context.walletRepository.save(wallet);

    await context.wagerTransactionRepository.save(transaction);

    if (ledgerEntry) {
      await context.ledgerEntryRepository.save(ledgerEntry);
    }

    const processedEvent = new WagerTransactionProcessedEvent({
      eventId: transaction.transactionId,
      aggregateId: transaction.transactionId,
      correlationId:
        this.correlationIdService.get() ?? transaction.transactionId,
      occurredAt: new Date(),
      data: {
        transactionId: transaction.transactionId,
        walletId: wallet.walletId,
        playerId: wallet.ownerId,
        externalTransactionId: transaction.externalId,
        providerId: transaction.provider,
        kind: transaction.transactionKind,
        amount: {
          amount: transaction.value.amount,
          currency: transaction.value.currencyCode,
        },
        currency: transaction.value.currencyCode,
        balanceBefore: {
          amount: balanceBefore.amount,
          currency: balanceBefore.currencyCode,
        },
        balanceAfter: {
          amount: balanceAfter.amount,
          currency: balanceAfter.currencyCode,
        },
      },
    });

    await context.outboxRepository.save(OutboxMessage.enqueue(processedEvent));

    if (direction !== null) {
      const balanceChangedEvent = new WalletBalanceChangedEvent({
        eventId: randomUUID(),
        aggregateId: wallet.walletId,
        correlationId:
          this.correlationIdService.get() ?? transaction.transactionId,
        occurredAt: new Date(),
        data: {
          walletId: wallet.walletId,
          transactionId: transaction.transactionId,
          direction,
          money: {
            amount: amount.amount,
            currency: amount.currencyCode,
          },
          balanceBefore: {
            amount: balanceBefore.amount,
            currency: balanceBefore.currencyCode,
          },
          balanceAfter: {
            amount: balanceAfter.amount,
            currency: balanceAfter.currencyCode,
          },
          walletVersion: wallet.currentVersion,
        },
      });

      await context.outboxRepository.save(
        OutboxMessage.enqueue(balanceChangedEvent),
      );
    }

    return {
      transaction,
      replayed: false,
    };
  }
}
