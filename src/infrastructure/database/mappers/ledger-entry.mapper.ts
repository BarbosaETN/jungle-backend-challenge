import { Money } from '../../../domain/money/money';
import { LedgerEntry } from '../../../domain/ledger/ledger-entry';
import { LedgerEntryEntity } from '../entities/ledger-entry.entity';

export class LedgerEntryMapper {
  static toDomain(entity: LedgerEntryEntity): LedgerEntry {
    const amount = Money.from(entity.amount, entity.currency);

    const balanceBefore = Money.from(
      entity.balanceBefore,
      entity.currency,
    );

    const balanceAfter = Money.from(
      entity.balanceAfter,
      entity.currency,
    );

    return LedgerEntry.restore({
      id: entity.id,
      walletId: entity.wallet.id,
      transactionId: entity.transaction.id,
      direction: entity.direction,
      amount,
      balanceBefore,
      balanceAfter,
      createdAt: entity.createdAt,
    });
  }

  static toEntity(
    entry: LedgerEntry,
    wallet: LedgerEntryEntity['wallet'],
    transaction: LedgerEntryEntity['transaction'],
  ): LedgerEntryEntity {
    const entity = new LedgerEntryEntity();

    entity.id = entry.entryId;
    entity.wallet = wallet;
    entity.transaction = transaction;
    entity.direction = entry.entryDirection;
    entity.amount = entry.value.amount;
    entity.currency = entry.value.currencyCode;
    entity.balanceBefore = entry.previousBalance.amount;
    entity.balanceAfter = entry.resultingBalance.amount;
    entity.createdAt = entry.creationDate;

    return entity;
  }
}
