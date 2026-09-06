import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import express from 'express';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/http-exception.filter';
import { AppSettings } from './config/app.config';
import { AssistantService } from './assistant/assistant.service';
import { buildLlm } from './assistant/llm';
import { PrismaService } from './prisma/prisma.service';
import { seedIfEmpty, backfillImages } from './seed/seed';

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });
  const settings = app.get(AppSettings);

  app.enableCors({
    origin: [settings.frontendOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });
  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const message = errors
          .map((e: { property: string; constraints?: Record<string, string> }) => {
            const constraints = Object.values(e.constraints ?? {});
            return constraints.join(', ') || `${e.property} is invalid`;
          })
          .join('; ');
        return new UnprocessableEntityException({
          error: { code: 'VALIDATION_ERROR', message: message || 'validation failed' },
        });
      },
    }),
  );

  const publicDir = existsSync(join(process.cwd(), 'public'))
    ? join(process.cwd(), 'public')
    : join(__dirname, '..', 'public');
  if (existsSync(publicDir)) {
    app.use('/static', express.static(publicDir));
  }

  const swagger = new DocumentBuilder()
    .setTitle('Field & Wren')
    .setDescription('Commerce backend for the BluBird Interactive assignment. Prices are integer cents.')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    customSiteTitle: 'Field & Wren API',
  });

  await app.init();

  const assistant = app.get(AssistantService);
  assistant.setLlm(buildLlm(settings));

  if (settings.seedOnStart) {
    const prisma = app.get(PrismaService);
    await seedIfEmpty(prisma);
    await backfillImages(prisma);
  }

  return app;
}

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT || 8000);
  await app.listen(port, '127.0.0.1');
  console.log(`Field & Wren API → http://127.0.0.1:${port}`);
  console.log(`OpenAPI          → http://127.0.0.1:${port}/docs`);
}

if (require.main === module) {
  bootstrap();
}
