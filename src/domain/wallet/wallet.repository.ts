import { Currency } from '../money/currency';
import { Wallet } from './wallet';

export interface WalletRepository {
  findById(id: string): Promise<Wallet | null>;
  findByPlayerAndCurrency(
    playerId: string,
    currency: Currency,
  ): Promise<Wallet | null>;
  save(wallet: Wallet): Promise<void>;
}
