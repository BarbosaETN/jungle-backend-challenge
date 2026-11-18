import {
  Check,
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

@Unique({
  name: 'ledger_transaction_wallet_unique',
  properties: ['transaction', 'wallet'],
})
@Index({
  name: 'ledger_wallet_created_idx',
  properties: ['wallet', 'createdAt', 'id'],
})
@Check({
  name: 'wallet_ledger_entries_amount_positive',
  expression: 'amount > 0',
})
@Check({
  name: 'wallet_ledger_entries_balance_after_non_negative',
  expression: 'balance_after >= 0',
})
@Check({
  name: 'wallet_ledger_entries_balance_before_non_negative',
  expression: 'balance_before >= 0',
})
@Check({
  name: 'wallet_ledger_entries_balance_transition',
  expression:
    "((direction = 'DEBIT') AND (balance_after = balance_before - amount)) OR ((direction = 'CREDIT') AND (balance_after = balance_before + amount))",
})
@Check({
  name: 'wallet_ledger_entries_currency_format',
  expression: "currency ~ '^[A-Z]{3}$'",
})
@Entity({ tableName: 'wallet_ledger_entries' })
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
