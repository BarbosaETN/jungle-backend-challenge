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
import type { WagerTransactionKind } from '../../../domain/wager-transaction/wager-transaction-kind';
import type { WagerTransactionStatus } from '../../../domain/wager-transaction/wager-transaction-status';
import { WalletEntity } from './wallet.entity';

@Entity({ tableName: 'wager_transactions' })
@Unique({
  name: 'wager_transaction_provider_external_unique',
  properties: ['providerId', 'externalTransactionId'],
})
@Unique({
  name: 'wager_transaction_idempotency_unique',
  properties: ['idempotencyKey'],
})
@Index({
  name: 'wager_transaction_wallet_idx',
  properties: ['wallet'],
})
@Index({
  name: 'wager_transaction_player_idx',
  properties: ['playerId'],
})
@Index({
  name: 'wager_transaction_status_idx',
  properties: ['status'],
})
@Index({
  name: 'wager_transaction_provider_reference_idx',
  properties: [
    'providerId',
    'referenceExternalTransactionId',
  ],
})
export class WagerTransactionEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string', length: 100 })
  providerId!: string;

  @Property({ type: 'string', length: 255 })
  externalTransactionId!: string;

  @Property({ type: 'string', length: 255 })
  idempotencyKey!: string;

  @Property({ type: 'string', length: 64 })
  payloadHash!: string;

  @ManyToOne(() => WalletEntity)
  wallet!: WalletEntity;

  @Property({ type: 'string', length: 255 })
  playerId!: string;

  @Property({ type: 'string', length: 255 })
  roundId!: string;

  @Property({ type: 'string', length: 255 })
  gameId!: string;

  @Property({ type: 'decimal', precision: 20, scale: 2 })
  amount!: string;

  @Property({ type: 'string', length: 3 })
  currency!: Currency;

  @Enum({
    items: [
      'OPENING',
      'BET',
      'WIN',
      'LOSS',
      'REFUND',
      'ROLLBACK',
    ],
  })
  kind!: WagerTransactionKind;

  @Property({ type: 'string', length: 255, nullable: true })
  referenceExternalTransactionId?: string;

  @ManyToOne(() => WagerTransactionEntity, {
    nullable: true,
  })
  referenceTransaction?: WagerTransactionEntity;

  @Enum({
    items: [
      'PENDING',
      'PENDING_REFERENCE',
      'PROCESSED',
      'REJECTED',
      'FAILED',
    ],
  })
  status!: WagerTransactionStatus;

  @Property({ type: 'string', length: 100, nullable: true })
  failureCode?: string;

  @Property({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Property({
    type: 'timestamptz',
    onCreate: () => new Date(),
  })
  createdAt!: Date;
}