import { EntityManager } from '@mikro-orm/postgresql';

import {
  DatabaseTransaction,
  DatabaseTransactionContext,
} from '../../../application/common/database-transaction';

import { MikroOrmWalletRepository } from '../repositories/mikro-orm-wallet.repository';
import { MikroOrmWagerTransactionRepository } from '../repositories/mikro-orm-wager-transaction.repository';
import { MikroOrmLedgerEntryRepository } from '../repositories/mikro-orm-ledger-entry.repository';
import { MikroOrmOutboxMessageRepository } from '../repositories/mikro-orm-outbox-message.repository';

export class MikroOrmDatabaseTransaction implements DatabaseTransaction {
  constructor(private readonly em: EntityManager) {}

  async run<T>(
    operation: (context: DatabaseTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.em.transactional(async (transactionalEm) => {
      const context: DatabaseTransactionContext = {
        walletRepository: new MikroOrmWalletRepository(
          transactionalEm,
        ),
        wagerTransactionRepository:
          new MikroOrmWagerTransactionRepository(
            transactionalEm,
          ),
        ledgerEntryRepository:
          new MikroOrmLedgerEntryRepository(
            transactionalEm,
          ),
        outboxRepository:
          new MikroOrmOutboxMessageRepository(
            transactionalEm,
          ),
      };

      return operation(context);
    });
  }
}