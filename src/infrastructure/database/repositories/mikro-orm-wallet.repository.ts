import { EntityManager } from '@mikro-orm/postgresql';
import { Wallet } from '../../../domain/wallet/wallet';
import { WalletRepository } from '../../../domain/wallet/wallet.repository';
import { WalletEntity } from '../entities/wallet.entity';
import { WalletMapper } from '../mappers/wallet.mapper';
import type { Currency } from '../../../domain/money/currency';
import { WalletConcurrencyError } from '../../../domain/wallet/errors/wallet-concurrency.error';

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

    const expectedVersion = wallet.currentVersion;

    const affectedRows = await this.em.nativeUpdate(
      WalletEntity,
      {
        id: wallet.walletId,
        version: expectedVersion,
      },
      {
        playerId: wallet.ownerId,
        balance: wallet.currentBalance.amount,
        currency: wallet.currentBalance.currencyCode,
        version: expectedVersion + 1,
      },
    );

    if (affectedRows === 0) {
      this.em.clear();

      throw new WalletConcurrencyError(wallet.walletId, expectedVersion);
    }

    this.em.clear();
  }
}
