import {
  Controller,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

import { Money } from '../../domain/money/money';
import { MikroOrmWalletRepository } from '../../infrastructure/database/repositories/mikro-orm-wallet.repository';
import { MikroOrmLedgerEntryRepository } from '../../infrastructure/database/repositories/mikro-orm-ledger-entry.repository';

@Controller('wallets')
export class ReconciliationController {
  private readonly walletRepository: MikroOrmWalletRepository;
  private readonly ledgerRepository: MikroOrmLedgerEntryRepository;

  constructor(private readonly em: EntityManager) {
    this.walletRepository = new MikroOrmWalletRepository(em);
    this.ledgerRepository = new MikroOrmLedgerEntryRepository(em);
  }

  @Post(':walletId/reconciliation')
  async reconcile(@Param('walletId') walletId: string) {
    const wallet = await this.walletRepository.findById(walletId);

    if (!wallet) {
      throw new NotFoundException(`Wallet not found: ${walletId}`);
    }

    const entries = await this.ledgerRepository.findByWalletId(walletId);

    let calculatedBalance = Money.from(
      '0',
      wallet.currentBalance.currencyCode,
    );

    for (const entry of entries) {
      if (entry.entryDirection === 'CREDIT') {
        calculatedBalance = calculatedBalance.add(entry.value);
      } else {
        calculatedBalance = calculatedBalance.subtract(entry.value);
      }
    }

    const storedBalance = wallet.currentBalance;

    const difference = storedBalance.subtract(calculatedBalance);

    return {
      walletId,
      storedBalance: storedBalance.amount,
      calculatedBalance: calculatedBalance.amount,
      difference: difference.amount,
      currency: storedBalance.currencyCode,
      consistent: storedBalance.equals(calculatedBalance),
      checkedEntries: entries.length,
    };
  }
}
