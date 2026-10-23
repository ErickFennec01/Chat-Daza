import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import { AppModule } from './app.module';

async function bootstrap() {
  loadEnv();
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(',') ?? [], credentials: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(Number(process.env.PORT ?? 8000), '0.0.0.0');
}

void bootstrap();
