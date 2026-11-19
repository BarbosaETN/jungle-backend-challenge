import { Money } from '../../domain/money/money';
import { LedgerEntry } from '../../domain/ledger/ledger-entry';
import { WagerTransaction } from '../../domain/wager-transaction/wager-transaction';

import type { DatabaseTransaction } from '../common/database-transaction';
import { IdempotencyService } from '../idempotency/idempotency.service';

import type { FinancialTransactionRequest } from './financial-transaction.request';
import type { FinancialTransactionResult } from './financial-transaction.result';
import { OutboxMessage } from '../../domain/outbox/outbox-message';
import { LoggerService } from '../../infrastructure/observability/logger.service';
import { LOG_EVENTS } from '../../infrastructure/observability/log-events';
import { randomUUID } from 'crypto';
import { CorrelationIdService } from '../../infrastructure/observability/correlation-id.service';

export class FinancialTransactionService {
  constructor(
    private readonly databaseTransaction: DatabaseTransaction,
    private readonly idempotencyService: IdempotencyService,
    private readonly logger: LoggerService,
    private readonly correlationIdService: CorrelationIdService,
  ) {}

  async create(
    request: FinancialTransactionRequest,
    payloadHash: string,
  ): Promise<FinancialTransactionResult> {
    const result = await this.databaseTransaction.run(async (context) => {
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
        throw new Error(`Idempotency key conflict: ${request.idempotencyKey}`);
      }

      const wallet = await context.walletRepository.findById(request.walletId);

      if (!wallet) {
        throw new Error(`Wallet not found: ${request.walletId}`);
      }

      const amount = Money.from(request.amount, request.currency);

      const balanceBefore = wallet.currentBalance;

      wallet.debit(amount);

      const balanceAfter = wallet.currentBalance;

      const transaction = WagerTransaction.create({
        providerId: request.providerId,
        externalTransactionId: request.externalTransactionId,
        idempotencyKey: request.idempotencyKey,
        payloadHash,
        walletId: request.walletId,
        playerId: request.playerId,
        roundId: request.roundId,
        gameId: request.gameId,
        amount,
        kind: request.kind,
      });

      const ledgerEntry = LedgerEntry.create({
        walletId: wallet.walletId,
        transactionId: transaction.transactionId,
        direction: 'DEBIT',
        amount,
        balanceBefore,
        balanceAfter,
      });

      await context.walletRepository.save(wallet);

      await context.wagerTransactionRepository.save(transaction);

      await context.ledgerEntryRepository.save(ledgerEntry);

      const outboxMessage = OutboxMessage.create(
        randomUUID(),
        transaction.transactionId,
        'WAGER_TRANSACTION_PROCESSED',
        {
          transactionId: transaction.transactionId,
          walletId: wallet.walletId,
          playerId: wallet.ownerId,
          externalTransactionId: transaction.externalId,
          kind: transaction.transactionKind,
          amount: transaction.value.amount,
          currency: transaction.value.currencyCode,
          correlationId: this.correlationIdService.get(),
        },
      );

      await context.outboxRepository.save(outboxMessage);

      return {
        transaction,
        replayed: false,
      };
    });

    this.logger.info(LOG_EVENTS.TRANSACTION_CREATED, {
      transactionId: result.transaction.transactionId,
      walletId: request.walletId,
      playerId: request.playerId,
      idempotencyKey: request.idempotencyKey,
    });

    return result;
  }
}
