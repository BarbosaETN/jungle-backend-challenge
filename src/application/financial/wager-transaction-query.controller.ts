import {
  Controller,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

import { MikroOrmWagerTransactionRepository } from '../../infrastructure/database/repositories/mikro-orm-wager-transaction.repository';

@Controller()
export class WagerTransactionQueryController {
  private readonly repository: MikroOrmWagerTransactionRepository;

  constructor(em: EntityManager) {
    this.repository = new MikroOrmWagerTransactionRepository(em);
  }

  @Get('wagering/transactions/:transactionId')
  async findById(@Param('transactionId') transactionId: string) {
    const transaction = await this.repository.findById(transactionId);

    if (!transaction) {
      throw new NotFoundException(
        `Transaction not found: ${transactionId}`,
      );
    }

    return this.toResponse(transaction);
  }

  @Get(
    'providers/:providerId/wagering/transactions/:externalTransactionId',
  )
  async findByProviderAndExternalId(
    @Param('providerId') providerId: string,
    @Param('externalTransactionId') externalTransactionId: string,
  ) {
    const transaction =
      await this.repository.findByProviderAndExternalId(
        providerId,
        externalTransactionId,
      );

    if (!transaction) {
      throw new NotFoundException(
        `Transaction not found: ${providerId}/${externalTransactionId}`,
      );
    }

    return this.toResponse(transaction);
  }

  private toResponse(transaction: any) {
    return {
      transactionId: transaction.transactionId,
      providerId: transaction.provider,
      externalTransactionId: transaction.externalId,
      idempotencyKey: transaction.idempotency,
      walletId: transaction.wallet,
      playerId: transaction.player,
      roundId: transaction.round,
      gameId: transaction.game,
      kind: transaction.transactionKind,
      status: transaction.currentStatus,
      amount: transaction.value.amount,
      currency: transaction.value.currencyCode,
      referenceExternalTransactionId:
        transaction.referenceExternalId ?? null,
      referenceTransactionId:
        transaction.referenceId ?? null,
      failureCode: transaction.errorCode ?? null,
      processedAt: transaction.processedDate ?? null,
      createdAt: transaction.creationDate,
    };
  }
}