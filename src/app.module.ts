import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from './infrastructure/database/mikro-orm.config';
import { WorkersModule } from './infrastructure/workers/workers.module';
import { AuthModule } from './application/auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MiddlewareConsumer} from '@nestjs/common';
import { CorrelationIdMiddleware } from './infrastructure/observability/correlation-id.middleware';
import { CorrelationIdService } from './infrastructure/observability/correlation-id.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MikroOrmModule.forRoot(mikroOrmConfig),
    WorkersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, CorrelationIdService,],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}