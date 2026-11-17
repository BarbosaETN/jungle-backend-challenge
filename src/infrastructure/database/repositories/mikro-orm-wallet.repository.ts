import { EntityManager } from '@mikro-orm/postgresql';
import { Wallet } from '../../../domain/wallet/wallet';
import { WalletRepository } from '../../../domain/wallet/wallet.repository';
import { WalletEntity } from '../entities/wallet.entity';
import { WalletMapper } from '../mappers/wallet.mapper';
import type { Currency } from '../../../domain/money/currency';

export class MikroOrmWalletRepository implements WalletRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<Wallet | null> {
    const entity = await this.em.findOne(WalletEntity, { id });

    if (!entity) {
      return null;
    }

    return WalletMapper.toDomain(entity);
  }

  async findByPlayerAndCurrency(
    playerId: string,
    currency: Currency,
  ): Promise<Wallet | null> {
    const entity = await this.em.findOne(WalletEntity, {
      playerId,
      currency,
    });

    if (!entity) {
      return null;
    }

    return WalletMapper.toDomain(entity);
  }

  async save(wallet: Wallet): Promise<void> {
    const existingEntity = await this.em.findOne(WalletEntity, {
      id: wallet.walletId,
    });

    if (!existingEntity) {
      const entity = WalletMapper.toEntity(wallet);

      this.em.persist(entity);
      await this.em.flush();

      return;
    }

    existingEntity.playerId = wallet.ownerId;
    existingEntity.balance = wallet.currentBalance.amount;
    existingEntity.currency = wallet.currentBalance.currencyCode;
    existingEntity.version = wallet.currentVersion;

    await this.em.flush();
  }
}
