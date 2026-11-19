import { EntityManager } from '@mikro-orm/postgresql';

import type { LedgerEntry } from '../../../domain/ledger/ledger-entry';
import type { LedgerEntryRepository } from '../../../domain/ledger/ledger-entry.repository';

import { LedgerEntryEntity } from '../entities/ledger-entry.entity';
import { WalletEntity } from '../entities/wallet.entity';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';
import { LedgerEntryMapper } from '../mappers/ledger-entry.mapper';

export class MikroOrmLedgerEntryRepository implements LedgerEntryRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<LedgerEntry | null> {
    const entity = await this.em.findOne(
      LedgerEntryEntity,
      { id },
      {
        populate: ['wallet', 'transaction'],
      },
    );

    if (!entity) {
      return null;
    }

    return LedgerEntryMapper.toDomain(entity);
  }

  async findByTransactionId(
    transactionId: string,
  ): Promise<LedgerEntry | null> {
    const entity = await this.em.findOne(
      LedgerEntryEntity,
      {
        transaction: transactionId,
      },
      {
        populate: ['wallet', 'transaction'],
      },
    );

    if (!entity) {
      return null;
    }

    return LedgerEntryMapper.toDomain(entity);
  }

  async findByWalletId(walletId: string): Promise<LedgerEntry[]> {
    const entities = await this.em.find(
      LedgerEntryEntity,
      {
        wallet: walletId,
      },
      {
        populate: ['wallet', 'transaction'],
        orderBy: {
          createdAt: 'ASC',
        },
      },
    );

    return entities.map((entity) => LedgerEntryMapper.toDomain(entity));
  }

  async save(entry: LedgerEntry): Promise<void> {
    const wallet = await this.em.findOne(WalletEntity, { id: entry.wallet });

    if (!wallet) {
      throw new Error(`Wallet not found: ${entry.wallet}`);
    }

    const transaction = await this.em.findOne(WagerTransactionEntity, {
      id: entry.transaction,
    });

    if (!transaction) {
      throw new Error(`WagerTransaction not found: ${entry.transaction}`);
    }

    const existingEntity = await this.em.findOne(LedgerEntryEntity, {
      id: entry.entryId,
    });

    if (existingEntity) {
      throw new Error(`LedgerEntry cannot be updated: ${entry.entryId}`);
    }

    const entity = LedgerEntryMapper.toEntity(entry, wallet, transaction);

    this.em.persist(entity);

    await this.em.flush();
  }
}
