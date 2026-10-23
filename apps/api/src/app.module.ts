import { Module } from '@nestjs/common';
import { AppController } from './platform.controller';
import { AppService } from './platform.service';
import { DatabaseService } from './database.service';
import { TenantGuard } from './tenant.guard';
import { AuthService } from './auth.service';
import { WahaService } from './waha.service';

@Module({
  controllers: [AppController],
  providers: [AppService, DatabaseService, AuthService, WahaService, TenantGuard],
})
export class AppModule {}
