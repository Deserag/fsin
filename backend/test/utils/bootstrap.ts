import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../../dist/app.module.js';

export async function createTestApp(): Promise<INestApplication<Server>> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
  );
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

export async function loginAs(app: INestApplication<Server>, login: string, password = 'Admin123!'): Promise<string> {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ login, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${login}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

export const DEMO_USERS = {
  admin: 'admin',
  manager: 'duty',
  foreman1: 'usp1',
  foreman2: 'usp2',
};
