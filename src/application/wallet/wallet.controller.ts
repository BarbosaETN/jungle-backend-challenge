import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { createHash } from 'node:crypto';

import { Money } from '../../domain/money/money';
import { CURRENCIES, type Currency } from '../../domain/money/currency';
import { Wallet } from '../../domain/wallet/wallet';
import { WagerTransaction } from '../../domain/wager-transaction/wager-transaction';
import { LedgerEntry } from '../../domain/ledger/ledger-entry';

import { MikroOrmWalletRepository } from '../../infrastructure/database/repositories/mikro-orm-wallet.repository';
import { MikroOrmLedgerEntryRepository } from '../../infrastructure/database/repositories/mikro-orm-ledger-entry.repository';
import { MikroOrmDatabaseTransaction } from '../../infrastructure/database/transaction/mikro-orm-database-transaction';

interface CreateWalletRequest {
  playerId: string;
  initialBalance: {
    amount: string;
    currency: Currency;
  };
}

@Controller('wallets')
export class WalletController {
  private readonly walletRepository: MikroOrmWalletRepository;
  private readonly ledgerRepository: MikroOrmLedgerEntryRepository;

  constructor(
    private readonly em: EntityManager,
    private readonly databaseTransaction: MikroOrmDatabaseTransaction,
  ) {
    this.walletRepository = new MikroOrmWalletRepository(em);
    this.ledgerRepository = new MikroOrmLedgerEntryRepository(em);
  }

  @Post()
  async create(@Body() body: CreateWalletRequest) {
    if (!CURRENCIES.includes(body.initialBalance.currency)) {
      throw new Error(
        `Unsupported currency: ${body.initialBalance.currency}`,
      );
    }

    const initialBalance = Money.from(
      body.initialBalance.amount,
      body.initialBalance.currency,
    );

    const wallet = Wallet.create(body.playerId, initialBalance);

    const existing = await this.walletRepository.findByPlayerAndCurrency(
      body.playerId,
      body.initialBalance.currency,
    );

    if (existing) {
      throw new Error('Wallet already exists');
    }

    await this.databaseTransaction.run(async (context) => {
      await context.walletRepository.save(wallet);

      if (initialBalance.amount !== '0.00') {
        const openingTransaction = WagerTransaction.create({
          providerId: 'SYSTEM',
          externalTransactionId: `opening-${wallet.walletId}`,
          idempotencyKey: `wallet-opening-${wallet.walletId}`,
          payloadHash: createHash('sha256')
            .update(
              JSON.stringify({
                walletId: wallet.walletId,
                initialBalance: body.initialBalance,
              }),
            )
            .digest('hex'),
          walletId: wallet.walletId,
          playerId: wallet.ownerId,
          roundId: 'opening',
          gameId: 'system',
          amount: initialBalance,
          kind: 'OPENING',
        });

        await context.wagerTransactionRepository.save(openingTransaction);

        const ledgerEntry = LedgerEntry.create({
          walletId: wallet.walletId,
          transactionId: openingTransaction.transactionId,
          direction: 'CREDIT',
          amount: initialBalance,
          balanceBefore: Money.from(
            '0',
            initialBalance.currencyCode,
          ),
          balanceAfter: initialBalance,
        });

        await context.ledgerEntryRepository.save(ledgerEntry);
      }
    });

    return this.toResponse(wallet);
  }

  @Get(':walletId')
  async findById(@Param('walletId') walletId: string) {
    const wallet = await this.walletRepository.findById(walletId);

    if (!wallet) {
      throw new NotFoundException(`Wallet not found: ${walletId}`);
    }

    return this.toResponse(wallet);
  }

  @Get(':walletId/ledger')
  async ledger(@Param('walletId') walletId: string) {
    const wallet = await this.walletRepository.findById(walletId);

    if (!wallet) {
      throw new NotFoundException(`Wallet not found: ${walletId}`);
    }

    const entries = await this.ledgerRepository.findByWalletId(walletId);

    return entries.map((entry) => ({
      entryId: entry.entryId,
      transactionId: entry.transaction,
      direction: entry.entryDirection,
      amount: entry.value.amount,
      currency: entry.value.currencyCode,
      balanceBefore: entry.previousBalance.amount,
      balanceAfter: entry.resultingBalance.amount,
      createdAt: entry.creationDate,
    }));
  }

  private toResponse(wallet: Wallet) {
    return {
      walletId: wallet.walletId,
      playerId: wallet.ownerId,
      balance: wallet.currentBalance.amount,
      currency: wallet.currentBalance.currencyCode,
      version: wallet.currentVersion,
    };
  }
}