import type { LedgerEntryRepository } from '../../domain/ledger/ledger-entry.repository';
import type { OutboxMessageRepository } from '../../domain/outbox/outbox-message.repository';
import type { WagerTransactionRepository } from '../../domain/wager-transaction/wager-transaction.repository';
import type { WalletRepository } from '../../domain/wallet/wallet.repository';

export interface DatabaseTransactionContext {
  walletRepository: WalletRepository;
  wagerTransactionRepository: WagerTransactionRepository;
  ledgerEntryRepository: LedgerEntryRepository;
  outboxRepository: OutboxMessageRepository;
}

export interface DatabaseTransaction {
  run<T>(
    operation: (context: DatabaseTransactionContext) => Promise<T>,
  ): Promise<T>;
}