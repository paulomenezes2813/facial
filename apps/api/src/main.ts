import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Fotos em base64 podem ter ~2-5MB
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.enableCors({
    origin: process.env.WEB_URL?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  // Railway injeta PORT; em dev usa API_PORT do .env; fallback 3001.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  // Bind em 0.0.0.0 — NestJS 10 default é localhost, que não funciona em container.
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`✓ API rodando em http://localhost:${port}/api`);
}

bootstrap();
