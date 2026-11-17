import { Money } from '../../../domain/money/money';
import { WagerTransaction } from '../../../domain/wager-transaction/wager-transaction';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';

export class WagerTransactionMapper {
  static toDomain(entity: WagerTransactionEntity): WagerTransaction {
    const amount = Money.from(entity.amount, entity.currency);

    return WagerTransaction.restore({
      id: entity.id,
      providerId: entity.providerId,
      externalTransactionId: entity.externalTransactionId,
      idempotencyKey: entity.idempotencyKey,
      payloadHash: entity.payloadHash,
      walletId: entity.wallet.id,
      playerId: entity.playerId,
      roundId: entity.roundId,
      gameId: entity.gameId,
      amount,
      kind: entity.kind,
      status: entity.status,
      referenceExternalTransactionId:
        entity.referenceExternalTransactionId,
      referenceTransactionId:
        entity.referenceTransaction?.id,
      failureCode: entity.failureCode,
      processedAt: entity.processedAt,
      createdAt: entity.createdAt,
    });
  }

  static toEntity(
    transaction: WagerTransaction,
    wallet: WagerTransactionEntity['wallet'],
    referenceTransaction?: WagerTransactionEntity,
  ): WagerTransactionEntity {
    const entity = new WagerTransactionEntity();

    entity.id = transaction.transactionId;
    entity.providerId = transaction.provider;
    entity.externalTransactionId = transaction.externalId;
    entity.idempotencyKey = transaction.idempotency;
    entity.payloadHash = transaction.hash;
    entity.wallet = wallet;
    entity.playerId = transaction.player;
    entity.roundId = transaction.round;
    entity.gameId = transaction.game;
    entity.amount = transaction.value.amount;
    entity.currency = transaction.value.currencyCode;
    entity.kind = transaction.transactionKind;
    entity.referenceExternalTransactionId =
      transaction.referenceExternalId;
    entity.referenceTransaction = referenceTransaction;
    entity.status = transaction.currentStatus;
    entity.failureCode = transaction.errorCode;
    entity.processedAt = transaction.processedDate;
    entity.createdAt = transaction.creationDate;

    return entity;
  }
}