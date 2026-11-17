import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';

import type { Currency } from '../../../domain/money/currency';
import type { LedgerEntryDirection } from '../../../domain/ledger/ledger-entry-direction';

import { WalletEntity } from './wallet.entity';
import { WagerTransactionEntity } from './wager-transaction.entity';

@Entity({ tableName: 'wallet_ledger_entries' })
@Unique({
  name: 'ledger_transaction_wallet_unique',
  properties: ['transaction', 'wallet'],
})
@Index({
  name: 'ledger_wallet_created_idx',
  properties: ['wallet', 'createdAt', 'id'],
})
export class LedgerEntryEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => WalletEntity)
  wallet!: WalletEntity;

  @ManyToOne(() => WagerTransactionEntity)
  transaction!: WagerTransactionEntity;

  @Enum({ items: ['DEBIT', 'CREDIT'] })
  direction!: LedgerEntryDirection;

  @Property({
    type: 'decimal',
    precision: 20,
    scale: 2,
  })
  amount!: string;

  @Property({
    type: 'string',
    length: 3,
  })
  currency!: Currency;

  @Property({
    type: 'decimal',
    precision: 20,
    scale: 2,
  })
  balanceBefore!: string;

  @Property({
    type: 'decimal',
    precision: 20,
    scale: 2,
  })
  balanceAfter!: string;

  @Property({
    type: 'timestamptz',
    onCreate: () => new Date(),
  })
  createdAt!: Date;
}