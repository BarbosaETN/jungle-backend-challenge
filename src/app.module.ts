import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from './infrastructure/database/mikro-orm.config';
import { WorkersModule } from './infrastructure/workers/workers.module';

@Module({
  imports: [
    MikroOrmModule.forRoot(mikroOrmConfig),
    WorkersModule,
  ],
})
export class AppModule {}