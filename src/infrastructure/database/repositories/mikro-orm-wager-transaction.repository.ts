import { EntityManager } from '@mikro-orm/postgresql';

import { WagerTransaction } from '../../../domain/wager-transaction/wager-transaction';
import type { WagerTransactionRepository } from '../../../domain/wager-transaction/wager-transaction.repository';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';
import { WalletEntity } from '../entities/wallet.entity';
import { WagerTransactionMapper } from '../mappers/wager-transaction.mapper';

export class MikroOrmWagerTransactionRepository implements WagerTransactionRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<WagerTransaction | null> {
    const entity = await this.em.findOne(
      WagerTransactionEntity,
      { id },
      {
        populate: ['wallet', 'referenceTransaction'],
      },
    );

    if (!entity) {
      return null;
    }

    return WagerTransactionMapper.toDomain(entity);
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<WagerTransaction | null> {
    const entity = await this.em.findOne(
      WagerTransactionEntity,
      { idempotencyKey },
      {
        populate: ['wallet', 'referenceTransaction'],
      },
    );

    if (!entity) {
      return null;
    }

    return WagerTransactionMapper.toDomain(entity);
  }

  async findByProviderAndExternalId(
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null> {
    const entity = await this.em.findOne(
      WagerTransactionEntity,
      {
        providerId,
        externalTransactionId,
      },
      {
        populate: ['wallet', 'referenceTransaction'],
      },
    );

    if (!entity) {
      return null;
    }

    return WagerTransactionMapper.toDomain(entity);
  }

  async findPendingByReference(
    providerId: string,
    referenceExternalTransactionId: string,
  ): Promise<WagerTransaction[]> {
    const entities = await this.em.find(
      WagerTransactionEntity,
      {
        providerId,
        referenceExternalTransactionId,
        status: 'PENDING_REFERENCE',
      },
      {
        populate: ['wallet', 'referenceTransaction'],
        orderBy: {
          createdAt: 'ASC',
        },
      },
    );

    return entities.map((entity) => WagerTransactionMapper.toDomain(entity));
  }

  async findPendingReferences(): Promise<WagerTransaction[]> {
    const entities = await this.em.find(
      WagerTransactionEntity,
      {
        status: 'PENDING_REFERENCE',
      },
      {
        populate: ['wallet', 'referenceTransaction'],
        orderBy: {
          createdAt: 'ASC',
        },
      },
    );

    return entities.map((entity) => WagerTransactionMapper.toDomain(entity));
  }

  async save(transaction: WagerTransaction): Promise<void> {
    const wallet = await this.em.findOne(WalletEntity, {
      id: transaction.wallet,
    });

    if (!wallet) {
      throw new Error(`Wallet not found: ${transaction.wallet}`);
    }

    let referenceTransaction: WagerTransactionEntity | undefined;

    if (transaction.referenceId) {
      referenceTransaction =
        (await this.em.findOne(WagerTransactionEntity, {
          id: transaction.referenceId,
        })) ?? undefined;
    }

    const existingEntity = await this.em.findOne(WagerTransactionEntity, {
      id: transaction.transactionId,
    });

    if (!existingEntity) {
      const entity = WagerTransactionMapper.toEntity(
        transaction,
        wallet,
        referenceTransaction,
      );

      this.em.persist(entity);
    } else {
      existingEntity.providerId = transaction.provider;
      existingEntity.externalTransactionId = transaction.externalId;
      existingEntity.idempotencyKey = transaction.idempotency;
      existingEntity.payloadHash = transaction.hash;
      existingEntity.wallet = wallet;
      existingEntity.playerId = transaction.player;
      existingEntity.roundId = transaction.round;
      existingEntity.gameId = transaction.game;
      existingEntity.amount = transaction.value.amount;
      existingEntity.currency = transaction.value.currencyCode;
      existingEntity.kind = transaction.transactionKind;
      existingEntity.referenceExternalTransactionId =
        transaction.referenceExternalId;
      existingEntity.referenceTransaction = referenceTransaction;
      existingEntity.status = transaction.currentStatus;
      existingEntity.failureCode = transaction.errorCode;
      existingEntity.processedAt = transaction.processedDate;
    }

    await this.em.flush();
  }
}
