import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import ExcelJS from 'exceljs';
import { createTestApp, loginAs, DEMO_USERS } from './utils/bootstrap.js';

const MAPPING = {
  lastName: 'Фамилия',
  firstName: 'Имя',
  middleName: 'Отчество',
  birthDate: 'Дата рождения',
  groupName: 'Группа',
  currentCourse: 'Курс',
  directionCode: 'Направление (код)',
  programCode: 'Программа (код)',
  enrollmentYear: 'Год поступления',
  statusCode: 'Статус (код)',
};

async function buildWorkbook(rows: (string | number)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Студенты');
  ws.addRow(Object.values(MAPPING));
  for (const row of rows) ws.addRow(row);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('Excel import — no hidden partial import (e2e)', () => {
  let app: INestApplication<Server>;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAs(app, DEMO_USERS.admin);
  });

  afterAll(async () => {
    await app.close();
  });

  it('validates every row from the file, not just the 10-row preview, and only imports the valid ones', async () => {
    // 12 rows: 10 valid + 2 with a group that does not exist. If validate()
    // only looked at previewData (capped at 10) it would report 10/0 here
    // instead of 12 total / 2 errors.
    const rows: (string | number)[][] = [];
    for (let i = 0; i < 10; i++) {
      rows.push([`Фамилия${i}`, `Имя${i}`, 'Отчество', '2000-01-01', '201', 2, 'LAW', '40.03.01', 2024, 'STUDYING']);
    }
    rows.push(['Ошибка1', 'Тест', '', '2000-01-01', 'НЕСУЩЕСТВУЕТ', 2, 'LAW', '40.03.01', 2024, 'STUDYING']);
    rows.push(['Ошибка2', 'Тест', '', '2000-01-01', 'НЕСУЩЕСТВУЕТ', 2, 'LAW', '40.03.01', 2024, 'STUDYING']);

    const buffer = await buildWorkbook(rows);
    const parse = await request(app.getHttpServer())
      .post('/api/imports/students/parse')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', buffer, 'test.xlsx')
      .expect(201);

    expect(parse.body.totalRows).toBe(12);
    expect(parse.body.previewData.length).toBe(10); // display cap, not a data cap

    await request(app.getHttpServer())
      .post('/api/imports/students/mapping')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ jobId: parse.body.jobId, mapping: MAPPING })
      .expect(201);

    const validate = await request(app.getHttpServer())
      .post('/api/imports/students/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ jobId: parse.body.jobId })
      .expect(201);

    expect(validate.body.totalRows).toBe(12);
    expect(validate.body.validRows).toBe(10);
    expect(validate.body.errorRows).toBe(2);

    const before = await request(app.getHttpServer())
      .get('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ search: 'Фамилия' });

    const confirm = await request(app.getHttpServer())
      .post('/api/imports/students/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ jobId: parse.body.jobId })
      .expect(201);

    expect(confirm.body.importedRows).toBe(10);

    const after = await request(app.getHttpServer())
      .get('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ search: 'Фамилия', limit: 50 });

    expect(after.body.meta.total - before.body.meta.total).toBe(10);
  });
});
