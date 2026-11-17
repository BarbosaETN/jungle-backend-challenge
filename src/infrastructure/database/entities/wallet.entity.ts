import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import type { Currency } from '../../../domain/money/currency';

@Unique({
  name: 'wallet_player_currency_unique',
  properties: ['playerId', 'currency'],
})
@Entity({ tableName: 'wallets' })
export class WalletEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string', length: 255 })
  playerId!: string;

  @Property({ type: 'decimal', precision: 20, scale: 2 })
  balance!: string;

  @Property({ type: 'string', length: 3 })
  currency!: Currency;

  @Property({ type: 'integer', default: 1 })
  version!: number;

  @Property({
    type: 'timestamptz',
    onCreate: () => new Date(),
  })
  createdAt!: Date;

  @Property({
    type: 'timestamptz',
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt!: Date;
}