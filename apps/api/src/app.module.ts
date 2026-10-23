import { Module } from '@nestjs/common';
import { AppController } from './platform.controller';
import { AppService } from './platform.service';
import { DatabaseService } from './database.service';
import { TenantGuard } from './tenant.guard';

@Module({
  controllers: [AppController],
  providers: [AppService, DatabaseService, TenantGuard],
})
export class AppModule {}
