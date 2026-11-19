import { FinancialTransactionService } from '../financial/financial-transaction.service';
import { MikroOrmWagerTransactionRepository } from '../../infrastructure/database/repositories/mikro-orm-wager-transaction.repository';

export class PendingReferenceWorker {
  constructor(
    private readonly transactionRepository: MikroOrmWagerTransactionRepository,
    private readonly financialTransactionService: FinancialTransactionService,
  ) {}

  async process(): Promise<void> {
    const pendingTransactions =
      await this.transactionRepository.findPendingReferences();

    for (const transaction of pendingTransactions) {
      try {
        await this.financialTransactionService.reprocessPendingReference(
          transaction,
        );
      } catch {
        // A referência ainda pode não existir.
        // A transação permanece PENDING_REFERENCE para uma próxima tentativa.
      }
    }
  }
}