import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from './infrastructure/database/mikro-orm.config';
import { WorkersModule } from './infrastructure/workers/workers.module';
import { AuthModule } from './application/auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MiddlewareConsumer } from '@nestjs/common';
import { CorrelationIdMiddleware } from './infrastructure/observability/correlation-id.middleware';
import { CorrelationIdService } from './infrastructure/observability/correlation-id.service';
import { WalletController } from './application/wallet/wallet.controller';
import { IdempotencyService } from './application/idempotency/idempotency.service';
import { FinancialTransactionService } from './application/financial/financial-transaction.service';
import { MikroOrmDatabaseTransaction } from './infrastructure/database/transaction/mikro-orm-database-transaction';
import { MikroOrmWagerTransactionRepository } from './infrastructure/database/repositories/mikro-orm-wager-transaction.repository';
import { LoggerService } from './infrastructure/observability/logger.service';
import { EntityManager } from '@mikro-orm/postgresql';
import { FinancialTransactionController } from './application/financial/financial-transaction.controller';
import { WagerTransactionQueryController } from './application/financial/wager-transaction-query.controller';
import { ReconciliationController } from './application/reconciliation/reconciliation.controller';
import { PendingReferenceWorker } from './application/workers/pending-reference.worker';
import { WalletConcurrencyRetryService } from './application/concurrency/wallet-concurrency-retry.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MikroOrmModule.forRoot(mikroOrmConfig),
    WorkersModule,
    AuthModule,
  ],
  controllers: [
    AppController,
    WalletController,
    FinancialTransactionController,
    WagerTransactionQueryController,
    ReconciliationController,
  ],
  providers: [
    AppService,
    CorrelationIdService,
    {
      provide: MikroOrmDatabaseTransaction,
      useFactory: (em: EntityManager) => new MikroOrmDatabaseTransaction(em),
      inject: [EntityManager],
    },

    {
      provide: MikroOrmWagerTransactionRepository,
      useFactory: (em: EntityManager) =>
        new MikroOrmWagerTransactionRepository(em),
      inject: [EntityManager],
    },

    {
      provide: IdempotencyService,
      useFactory: (repository: MikroOrmWagerTransactionRepository) =>
        new IdempotencyService(repository),
      inject: [MikroOrmWagerTransactionRepository],
    },

    LoggerService,

    {
      provide: FinancialTransactionService,
      useFactory: (
        databaseTransaction: MikroOrmDatabaseTransaction,
        idempotencyService: IdempotencyService,
        logger: LoggerService,
        correlationIdService: CorrelationIdService,
      ) =>
        new FinancialTransactionService(
          databaseTransaction,
          idempotencyService,
          logger,
          correlationIdService,
          new WalletConcurrencyRetryService()
        ),
      inject: [
        MikroOrmDatabaseTransaction,
        IdempotencyService,
        LoggerService,
        CorrelationIdService,
      ],
    },
    {
      provide: PendingReferenceWorker,
      useFactory: (
        transactionRepository: MikroOrmWagerTransactionRepository,
        financialTransactionService: FinancialTransactionService,
      ) =>
        new PendingReferenceWorker(
          transactionRepository,
          financialTransactionService,
        ),
      inject: [MikroOrmWagerTransactionRepository, FinancialTransactionService],
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
