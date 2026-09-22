import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { createTestApp, loginAs, DEMO_USERS } from './utils/bootstrap.js';

describe('RBAC scope enforcement (e2e)', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin sees all groups, foreman sees only their assigned group', async () => {
    const adminToken = await loginAs(app, DEMO_USERS.admin);
    const foremanToken = await loginAs(app, DEMO_USERS.foreman1);

    const adminGroups = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const foremanGroups = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Authorization', `Bearer ${foremanToken}`)
      .expect(200);

    expect(adminGroups.body.data.length).toBeGreaterThan(1);
    expect(foremanGroups.body.data.length).toBe(1);
    expect(foremanGroups.body.data[0].name).toBe('201');
  });

  it('two foremen see disjoint group sets', async () => {
    const foreman1Token = await loginAs(app, DEMO_USERS.foreman1);
    const foreman2Token = await loginAs(app, DEMO_USERS.foreman2);

    const g1 = await request(app.getHttpServer()).get('/api/groups').set('Authorization', `Bearer ${foreman1Token}`);
    const g2 = await request(app.getHttpServer()).get('/api/groups').set('Authorization', `Bearer ${foreman2Token}`);

    const ids1 = new Set(g1.body.data.map((g: any) => g.id));
    const ids2 = g2.body.data.map((g: any) => g.id);
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  it('non-admin endpoints reject requests with no token', async () => {
    await request(app.getHttpServer()).get('/api/groups').expect(401);
  });

  it('admin-only endpoints reject a manager token', async () => {
    const managerToken = await loginAs(app, DEMO_USERS.manager);
    await request(app.getHttpServer())
      .get('/api/audit')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });

  it('students list is scoped: foreman only sees students in their own group', async () => {
    const foremanToken = await loginAs(app, DEMO_USERS.foreman1);
    const res = await request(app.getHttpServer())
      .get('/api/students')
      .set('Authorization', `Bearer ${foremanToken}`)
      .expect(200);

    for (const student of res.body.data) {
      expect(student.currentGroup?.name).toBe('201');
    }
  });
});
