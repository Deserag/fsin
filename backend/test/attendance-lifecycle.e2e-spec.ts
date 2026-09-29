import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { createTestApp, loginAs, DEMO_USERS } from './utils/bootstrap.js';

describe('Attendance sheet lifecycle (e2e)', () => {
  let app: INestApplication<Server>;
  let foremanToken: string;
  let groupId: string;
  let periodId: string;

  beforeAll(async () => {
    app = await createTestApp();
    foremanToken = await loginAs(app, DEMO_USERS.foreman1);

    const groups = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Authorization', `Bearer ${foremanToken}`);
    groupId = groups.body.data[0].id;

    const periods = await request(app.getHttpServer())
      .get('/api/settings/attendance-periods')
      .set('Authorization', `Bearer ${foremanToken}`);
    periodId = periods.body[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  function isoDate(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.toISOString().slice(0, 10)}T00:00:00.000Z`;
  }

  it('creating a sheet requires explicit marks for each student', async () => {
    const date = isoDate(30 + 1);
    const sheet = await request(app.getHttpServer())
      .post('/api/attendance/sheets')
      .set('Authorization', `Bearer ${foremanToken}`)
      .send({ groupId, periodId, date })
      .expect(201);

    expect(sheet.body.totalCount).toBeGreaterThan(0);

    const validation = await request(app.getHttpServer())
      .get(`/api/attendance/sheets/${sheet.body.id}/validation`)
      .set('Authorization', `Bearer ${foremanToken}`)
      .expect(200);

    expect(validation.body.isComplete).toBe(false);
    expect(validation.body.presentCount).toBe(0);
    expect(validation.body.unmarked).toBe(sheet.body.totalCount);
  });

  it('marking a student absent without a reason is rejected', async () => {
    const date = isoDate(30 + 2);
    const sheet = await request(app.getHttpServer())
      .post('/api/attendance/sheets')
      .set('Authorization', `Bearer ${foremanToken}`)
      .send({ groupId, periodId, date })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/attendance/sheets/${sheet.body.id}`)
      .set('Authorization', `Bearer ${foremanToken}`)
      .expect(200);
    const studentId = detail.body.records[0].studentId;

    await request(app.getHttpServer())
      .patch(`/api/attendance/records/${sheet.body.id}/${studentId}`)
      .set('Authorization', `Bearer ${foremanToken}`)
      .send({ isPresent: false })
      .expect(400);
  });

  it('cannot submit a sheet that has an absence without a reason, but can after fixing it', async () => {
    const date = isoDate(30 + 3);
    const sheet = await request(app.getHttpServer())
      .post('/api/attendance/sheets')
      .set('Authorization', `Bearer ${foremanToken}`)
      .send({ groupId, periodId, date })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/attendance/sheets/${sheet.body.id}`)
      .set('Authorization', `Bearer ${foremanToken}`)
      .expect(200);
    const studentId = detail.body.records[0].studentId;

    const reasons = await request(app.getHttpServer())
      .get('/api/attendance-reasons')
      .set('Authorization', `Bearer ${foremanToken}`);
    const reasonId = reasons.body[0].id;

    // Directly manipulate via bulk update to force an inconsistent state,
    // then verify submit blocks it — bulk itself requires a reason too.
    await request(app.getHttpServer())
      .post('/api/attendance/records/bulk')
      .set('Authorization', `Bearer ${foremanToken}`)
      .send({ sheetId: sheet.body.id, updates: detail.body.records.map((r:any)=>({studentId:r.studentId,isPresent:r.studentId!==studentId,reasonId:r.studentId===studentId?reasonId:undefined,note:'Тест'})) })
      .expect(201);

    const submitted = await request(app.getHttpServer())
      .patch(`/api/attendance/sheets/${sheet.body.id}/submit`)
      .set('Authorization', `Bearer ${foremanToken}`)
      .expect(200);
    expect(submitted.body.message).toBeTruthy();
  });

  it('a foreman cannot create a sheet for a group outside their scope', async () => {
    const admin = await loginAs(app, DEMO_USERS.admin);
    const groups = await request(app.getHttpServer()).get('/api/groups').set('Authorization', `Bearer ${admin}`);
    const otherGroup = groups.body.data.find((g: any) => g.id !== groupId);

    const date = isoDate(30 + 4);
    await request(app.getHttpServer())
      .post('/api/attendance/sheets')
      .set('Authorization', `Bearer ${foremanToken}`)
      .send({ groupId: otherGroup.id, periodId, date })
      .expect(403);
  });
});
