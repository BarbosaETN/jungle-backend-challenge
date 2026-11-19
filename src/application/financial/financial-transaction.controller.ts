import {
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { createHash } from 'crypto';

import { FinancialTransactionService } from './financial-transaction.service';
import type { FinancialTransactionRequest } from './financial-transaction.request';
import { CURRENCIES, type Currency } from '../../domain/money/currency';
import { WAGER_TRANSACTION_KINDS } from '../../domain/wager-transaction/wager-transaction-kind';

interface CreateWagerTransactionRequest {
  providerId: string;
  externalTransactionId: string;
  playerId: string;
  walletId: string;
  roundId: string;
  gameId: string;
  amount: string;
  currency: Currency;
  kind: (typeof WAGER_TRANSACTION_KINDS)[number];
  referenceExternalTransactionId?: string;
}

@Controller('wagering/transactions')
export class FinancialTransactionController {
  constructor(
    private readonly financialTransactionService: FinancialTransactionService,
  ) {}

  @Post()
  async create(
    @Body() body: CreateWagerTransactionRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new Error('Idempotency-Key header is required');
    }

    if (!CURRENCIES.includes(body.currency)) {
      throw new Error(`Unsupported currency: ${body.currency}`);
    }

    if (!WAGER_TRANSACTION_KINDS.includes(body.kind)) {
      throw new Error(`Unsupported transaction kind: ${body.kind}`);
    }

    const request: FinancialTransactionRequest = {
      providerId: body.providerId,
      externalTransactionId: body.externalTransactionId,
      idempotencyKey,
      playerId: body.playerId,
      walletId: body.walletId,
      roundId: body.roundId,
      gameId: body.gameId,
      amount: body.amount,
      currency: body.currency,
      kind: body.kind,
      referenceExternalTransactionId:
        body.referenceExternalTransactionId,
    };

    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          ...request,
          idempotencyKey: undefined,
        }),
      )
      .digest('hex');

    const result =
      await this.financialTransactionService.create(
        request,
        payloadHash,
      );

    return {
      transactionId: result.transaction.transactionId,
      externalTransactionId:
        result.transaction.externalId,
      status: result.transaction.currentStatus,
      kind: result.transaction.transactionKind,
      amount: result.transaction.value.amount,
      currency: result.transaction.value.currencyCode,
      walletId: result.transaction.wallet,
      replayed: result.replayed,
    };
  }
}