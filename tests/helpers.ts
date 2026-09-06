import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../code/backend/src/main';
import { PrismaService } from '../code/backend/src/prisma/prisma.service';
import { seedIfEmpty } from '../code/backend/src/seed/seed';
import { AssistantService } from '../code/backend/src/assistant/assistant.service';
import { ImporterService } from '../code/backend/src/operator/importer.service';
import { ToolDispatcher } from '../code/backend/src/assistant/tools';
import { AppSettings } from '../code/backend/src/config/app.config';
import { FakeLLM } from './fakes';

export type TestApp = {
  app: INestApplication;
  http: ReturnType<typeof request>;
};

export async function bootApp(): Promise<TestApp> {
  const app = await createApp();
  await app.init();
  const prisma = app.get(PrismaService);
  await prisma.resetForTests();
  await seedIfEmpty(prisma);
  return { app, http: request(app.getHttpServer()) };
}

export async function reset(app: INestApplication) {
  const prisma = app.get(PrismaService);
  await prisma.resetForTests();
  await seedIfEmpty(prisma);
  app.get(AssistantService).setLlm(null);
  app.get(ImporterService).setTransport(null);
}

export function setLlm(app: INestApplication, fake: FakeLLM) {
  app.get(AssistantService).setLlm(fake);
}

export function dispatcher(app: INestApplication) {
  return app.get(ToolDispatcher);
}

export function importer(app: INestApplication) {
  return app.get(ImporterService);
}

export function settings(app: INestApplication) {
  return app.get(AppSettings);
}

export async function ada(http: ReturnType<typeof request>) {
  const rows = (await http.get('/api/v1/customers')).body as { id: number; email: string }[];
  return rows.find((row) => row.email === 'ada@example.com')!;
}
