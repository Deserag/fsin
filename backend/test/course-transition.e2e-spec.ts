import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { createTestApp, loginAs, DEMO_USERS } from './utils/bootstrap.js';

describe('Course transition (e2e)', () => {
  let app: INestApplication<Server>;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAs(app, DEMO_USERS.admin);
  });

  afterAll(async () => {
    await app.close();
  });

  it('preview shows PROMOTE/GRADUATE/SKIP transitions with a summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/students/course-transition/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.transitions.length).toBeGreaterThan(0);
    expect(res.body.summary.total).toBe(res.body.transitions.length);
    expect(res.body.summary.toPromote + res.body.summary.toGraduate + res.body.summary.toSkip).toBe(
      res.body.summary.total,
    );
  });

  it('running execute twice does not double-promote students (idempotent)', async () => {
    const before = await request(app.getHttpServer())
      .get('/api/students/course-transition/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const promotedStudentId = before.body.transitions.find((t: any) => t.action === 'PROMOTE')?.studentId;
    expect(promotedStudentId).toBeTruthy();

    const first = await request(app.getHttpServer())
      .post('/api/students/course-transition/execute')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmed: true })
      .expect(201);
    expect(first.body.promoted).toBeGreaterThan(0);

    const studentAfterFirst = await request(app.getHttpServer())
      .get(`/api/students/${promotedStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const courseAfterFirst = studentAfterFirst.body.currentCourse;

    // Second run in the same academic year must be a no-op for this student
    const second = await request(app.getHttpServer())
      .post('/api/students/course-transition/execute')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmed: true })
      .expect(201);
    expect(second.body.promoted).toBe(0);
    expect(second.body.skipped).toBeGreaterThan(0);

    const studentAfterSecond = await request(app.getHttpServer())
      .get(`/api/students/${promotedStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(studentAfterSecond.body.currentCourse).toBe(courseAfterFirst);
  });

  it('a foreman cannot run the course transition (admin-only)', async () => {
    const foremanToken = await loginAs(app, DEMO_USERS.foreman1);
    await request(app.getHttpServer())
      .get('/api/students/course-transition/preview')
      .set('Authorization', `Bearer ${foremanToken}`)
      .expect(403);
  });
});
