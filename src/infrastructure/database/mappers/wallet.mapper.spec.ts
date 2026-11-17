import { Money } from '../../../domain/money/money';
import { WalletMapper } from './wallet.mapper';
import { WalletEntity } from '../entities/wallet.entity';
import { Wallet } from '../../../domain/wallet/wallet';

describe('WalletMapper', () => {
  it('should map a WalletEntity to a Wallet domain object', () => {
    const entity = new WalletEntity();

    entity.id = 'wallet-123';
    entity.playerId = 'player-123';
    entity.balance = '150.50';
    entity.currency = 'BRL';
    entity.version = 3;

    const wallet = WalletMapper.toDomain(entity);

    expect(wallet.walletId).toBe('wallet-123');
    expect(wallet.ownerId).toBe('player-123');
    expect(wallet.currentBalance.equals(Money.from('150.50', 'BRL'))).toBe(
      true,
    );
    expect(wallet.currentVersion).toBe(3);
  });

  it('should map a Wallet domain object to a WalletEntity', () => {
    const wallet = Wallet.restore(
      'wallet-123',
      'player-123',
      Money.from('250.75', 'BRL'),
      4,
    );

    const entity = WalletMapper.toEntity(wallet);

    expect(entity.id).toBe('wallet-123');
    expect(entity.playerId).toBe('player-123');
    expect(entity.balance).toBe('250.75');
    expect(entity.currency).toBe('BRL');
    expect(entity.version).toBe(4);
  });

  it('should preserve wallet data when mapping from entity to domain and back', () => {
    const entity = new WalletEntity();

    entity.id = 'wallet-456';
    entity.playerId = 'player-456';
    entity.balance = '999.99';
    entity.currency = 'USD';
    entity.version = 7;

    const wallet = WalletMapper.toDomain(entity);
    const mappedEntity = WalletMapper.toEntity(wallet);

    expect(mappedEntity.id).toBe(entity.id);
    expect(mappedEntity.playerId).toBe(entity.playerId);
    expect(mappedEntity.balance).toBe(entity.balance);
    expect(mappedEntity.currency).toBe(entity.currency);
    expect(mappedEntity.version).toBe(entity.version);
  });
});
