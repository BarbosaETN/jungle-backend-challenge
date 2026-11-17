import { Money } from '../../../domain/money/money';
import { Wallet } from '../../../domain/wallet/wallet';
import { WalletEntity } from '../entities/wallet.entity';

export class WalletMapper {
  static toDomain(entity: WalletEntity): Wallet {
    const balance = Money.from(entity.balance, entity.currency);

    return Wallet.restore(entity.id, entity.playerId, balance, entity.version);
  }

  static toEntity(wallet: Wallet): WalletEntity {
    const entity = new WalletEntity();

    entity.id = wallet.walletId;
    entity.playerId = wallet.ownerId;
    entity.balance = wallet.currentBalance.amount;
    entity.currency = wallet.currentBalance.currencyCode;
    entity.version = wallet.currentVersion;

    return entity;
  }
}
