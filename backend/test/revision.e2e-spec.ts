import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import request from 'supertest';
import {PrismaClient} from '@prisma/client';
import {JwtService} from '@nestjs/jwt';
import ExcelJS from 'exceljs';
import {createTestApp,loginAs,DEMO_USERS} from './utils/bootstrap.js';
const prisma=new PrismaClient();
describe('Revision: complete upgrade workflows',()=>{
 let app:any,admin:string,duty:string,usp:string,org:string,period:string,year:string,program:string,studying:string,expelled:string,groups:any[],students:any[],sheets:any[];
 const stamp=Date.now(),date='2040-10-01',context:any={course:'1',date};
 const api=(method:string,path:string,token=admin)=>(request(app.getHttpServer()) as any)[method]('/api'+path).set('Authorization',`Bearer ${token}`);
 beforeAll(async()=>{
  app=await createTestApp();admin=await loginAs(app,DEMO_USERS.admin);duty=await loginAs(app,DEMO_USERS.manager);usp=await loginAs(app,DEMO_USERS.foreman1);
  const user=await prisma.user.findUniqueOrThrow({where:{login:'admin'}});org=user.organizationId;
  period=(await prisma.attendancePeriod.findFirstOrThrow({where:{organizationId:org}})).id;
  program=(await prisma.educationalProgram.findFirstOrThrow({where:{organizationId:org}})).id;
  studying=(await prisma.studentStatus.findFirstOrThrow({where:{organizationId:org,code:'STUDYING'}})).id;expelled=(await prisma.studentStatus.findFirstOrThrow({where:{organizationId:org,code:'EXPELLED'}})).id;
  const y=await api('post','/academic-years').send({name:`2040-2041-${stamp}`,startDate:'2040-09-01',endDate:'2041-08-31'}).expect(201);year=y.body.id;Object.assign(context,{academicYearId:year,periodId:period});
  groups=[];students=[];
  for(let n=0;n<2;n++){const g=(await api('post','/groups').send({name:`test-${stamp}-${n}`,academicYearId:year,currentCourse:1,programId:program}).expect(201)).body;groups.push(g);for(const login of ['duty','usp1']){const u=await prisma.user.findUniqueOrThrow({where:{login}});await prisma.userGroupScope.create({data:{userId:u.id,groupId:g.id}});}for(let i=0;i<3;i++)students.push((await api('post','/students').send({lastName:`Fixture-${stamp}-${n}-${i}`,firstName:'Тест',gender:i===0?'FEMALE':'MALE',statusId:studying,currentGroupId:g.id,currentCourse:1,programId:program,enrollmentDate:'2040-09-01'}).expect(201)).body);}
 });
 afterAll(async()=>{await app?.close();await prisma.$disconnect();});
 it('login, expired access, refresh rotation and logout',async()=>{
  const login=await request(app.getHttpServer()).post('/api/auth/login').send({login:'usp2',password:'Admin123!'}).expect(200);
  const u=await prisma.user.findUniqueOrThrow({where:{login:'usp2'}});const expired=new JwtService({secret:process.env.JWT_SECRET}).sign({sub:u.id},{expiresIn:-1});
  await api('get','/auth/profile',expired).expect(401);
  const refreshed=await request(app.getHttpServer()).post('/api/auth/refresh').send({refreshToken:login.body.refreshToken}).expect(200);
  await api('get','/auth/profile',refreshed.body.accessToken).expect(200);
  await request(app.getHttpServer()).post('/api/auth/refresh').send({refreshToken:login.body.refreshToken}).expect(401);
  await api('post','/auth/logout',refreshed.body.accessToken).send({refreshToken:refreshed.body.refreshToken}).expect(200);
  await request(app.getHttpServer()).post('/api/auth/refresh').send({refreshToken:refreshed.body.refreshToken}).expect(401);
 });
 it('duplicate academic year yields 409, invalid dates yield 400',async()=>{
  const res=await api('post','/academic-years').send({name:`2040-2041-${stamp}`,startDate:'2040-09-01',endDate:'2041-08-31'}).expect(409);expect(res.body.message).toContain('уже существует');
  await api('post','/academic-years').send({name:'bad',startDate:'invalid',endDate:'2041-01-01'}).expect(400);
 });
 it('program scope grants and removes access to its groups',async()=>{
  const role=await prisma.role.findUniqueOrThrow({where:{name:'foreman'}});
  const account=(await api('post','/users').send({login:`scope-${stamp}`,password:'Scope123!',firstName:'Тест',lastName:'Программа',roleIds:[role.id],programScopeIds:[program]}).expect(201)).body;
  const token=await loginAs(app,account.login,'Scope123!');
  const visible=(await api('get','/groups',token).expect(200)).body.data;
  expect(groups.every(g=>visible.some((item:any)=>item.id===g.id))).toBe(true);
  await api('patch',`/users/${account.id}`).send({programScopeIds:[]}).expect(200);
  const hidden=(await api('get','/groups',token).expect(200)).body.data;
  expect(groups.every(g=>!hidden.some((item:any)=>item.id===g.id))).toBe(true);
 });
 it('course creates all accessible groups and lists explicit missing students',async()=>{
  sheets=(await api('post','/attendance/course',usp).send(context).expect(201)).body;expect(sheets).toHaveLength(2);expect(sheets.reduce((a:number,s:any)=>a+s.totalCount,0)).toBe(6);
  const validation=(await api('get',`/attendance/sheets/${sheets[0].id}/validation`,usp).expect(200)).body;expect(validation.unmarkedStudents).toHaveLength(3);
  await api('patch','/attendance/course',usp).send({...context,action:'submit'}).expect(400);
  expect(await prisma.attendanceSheet.count({where:{id:{in:sheets.map(s=>s.id)},status:'SUBMITTED'}})).toBe(0);
 });
 it('accepts inside-institute categories only for present students',async()=>{
  const formation=await prisma.attendanceReason.findFirstOrThrow({where:{organizationId:org,code:'IN_FORMATION'}});
  const outside=await prisma.attendanceReason.findFirstOrThrow({where:{organizationId:org,code:'ZUB'}});
  const studentId=sheets[0].records[0].studentId;
  await api('post','/attendance/records/bulk',usp).send({sheetId:sheets[0].id,updates:[{studentId,isPresent:true,reasonId:outside.id}]}).expect(400);
  await api('post','/attendance/records/bulk',usp).send({sheetId:sheets[0].id,updates:[{studentId,isPresent:true,reasonId:formation.id}]}).expect(201);
  const detail=(await api('get',`/attendance/sheets/${sheets[0].id}`,usp).expect(200)).body;
  expect(detail.records.find((r:any)=>r.studentId===studentId).reason.code).toBe('IN_FORMATION');
  expect(detail.records.find((r:any)=>r.studentId===studentId).student.gender).toBeTruthy();
 });
 it('excludes expelled after effective date and keeps their historical marks',async()=>{
  const id=students[0].id;await api('patch',`/students/${id}`).send({statusId:expelled,effectiveDate:'2040-10-02'}).expect(200);
  const newSheet=(await api('post','/attendance/sheets',usp).send({groupId:groups[0].id,periodId:period,date:'2040-10-03'}).expect(201)).body;
  const detail=(await api('get',`/attendance/sheets/${newSheet.id}`,usp).expect(200)).body;expect(detail.records.map((r:any)=>r.studentId)).not.toContain(id);expect(newSheet.totalCount).toBe(2);
  const old=(await api('get',`/attendance/sheets/${sheets[0].id}`,usp).expect(200)).body;expect(old.records.map((r:any)=>r.studentId)).toContain(id);
 });
 it('rejects outside-scope reads, explicit group filters, reports and exports',async()=>{
  const other=await loginAs(app,'usp2');
  await api('get',`/attendance/sheets/${sheets[0].id}`,other).expect(403);
  expect((await api('get','/attendance/sheets',other).query({groupId:groups[0].id}).expect(200)).body.data).toHaveLength(0);
  expect((await api('get','/reports/attendance',other).query({group:groups[0].id}).expect(200)).body.summary.total).toBe(0);
  const exported=await api('get','/exports/attendance',other).query({group:groups[0].id}).buffer(true).parse((res:any,cb:any)=>{const chunks:any[]=[];res.on('data',(x:any)=>chunks.push(x));res.on('end',()=>cb(null,Buffer.concat(chunks)));}).expect(200);const wb=new ExcelJS.Workbook();await wb.xlsx.load(exported.body);expect(JSON.stringify(wb.worksheets[0].getSheetValues())).not.toContain('Fixture-');
 });
 it('saves all course marks, submits atomically, returns with comment, reviews and closes',async()=>{
  const reason=await prisma.attendanceReason.findFirstOrThrow({where:{organizationId:org,code:'ILLNESS'}});
  for(const s of sheets)await api('post','/attendance/records/bulk',usp).send({sheetId:s.id,updates:s.records.map((r:any,i:number)=>({studentId:r.studentId,isPresent:i!==0,reasonId:i===0?reason.id:undefined}))}).expect(201);
  await api('patch','/attendance/course',usp).send({...context,action:'submit'}).expect(200);
  await api('post','/attendance/records/bulk',usp).send({sheetId:sheets[0].id,updates:[{studentId:students[0].id,isPresent:true}]}).expect(403);
  await api('patch','/attendance/course',duty).send({...context,action:'return',comment:'Уточнить причины'}).expect(200);
  expect((await api('get',`/attendance/sheets/${sheets[0].id}`,usp)).body.returnComment).toBe('Уточнить причины');
  await api('patch','/attendance/course',usp).send({...context,action:'submit'}).expect(200);
  await api('patch','/attendance/course',duty).send({...context,action:'review'}).expect(200);
  await api('patch','/attendance/course',duty).send({...context,action:'close'}).expect(200);
  expect(await prisma.attendanceSheet.count({where:{id:{in:sheets.map(s=>s.id)},status:'CLOSED'}})).toBe(2);
 });
 it('audits administrative correction and preserves CLOSED status',async()=>{
  await api('post','/attendance/records/bulk').send({sheetId:sheets[0].id,updates:[{studentId:students[0].id,isPresent:true}]}).expect(201);
  expect((await prisma.attendanceSheet.findUniqueOrThrow({where:{id:sheets[0].id}})).status).toBe('CLOSED');
  expect(await prisma.auditLog.count({where:{entityId:sheets[0].id,action:'ADMIN_CORRECTION'}})).toBe(1);
 });
 it('reports combine filters and retain historical course after promotion',async()=>{
  await api('patch',`/students/${students[1].id}`).send({currentCourse:3,effectiveDate:'2040-10-04'}).expect(200);
  const q={from:date,to:date,course:'1',program,group:groups.map(g=>g.id).join(','),statusId:studying};
  const report=(await api('get','/reports/attendance').query(q).expect(200)).body;expect(report.summary.total).toBe(6);expect(report.summary.present).toBe(5);expect(report.summary.absent).toBe(1);expect(report.daily).toHaveLength(1);expect(report.students).toHaveLength(6);
  expect((await api('get','/reports/attendance').query({...q,course:'3'}).expect(200)).body.summary.total).toBe(0);
  const exported=await api('get','/exports/attendance').query({from:date,to:date,course:'1'}).buffer(true).parse((res:any,cb:any)=>{const chunks:any[]=[];res.on('data',(part:any)=>chunks.push(part));res.on('end',()=>cb(null,Buffer.concat(chunks)));}).expect(200);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(exported.body);
  const roster=workbook.getWorksheet('Строевая записка');expect(roster).toBeTruthy();
  const values=JSON.stringify(roster!.getSheetValues());for(const label of ['По списку','Из них девушки','Наряд','ЗУБ','Практика'])expect(values).toContain(label);
  const totalRow=roster!.findRow(4);expect(totalRow?.getCell(2).value).toBe(6);expect(totalRow?.getCell(3).value).toBe(2);
 });
 it('archive, restore, edit and safe deletion of reference records',async()=>{
  const reason=(await api('post','/attendance-reasons').send({code:`test-${stamp}`,name:'Тест'}).expect(201)).body;
  await api('patch',`/attendance-reasons/${reason.id}`).send({name:'Изменено',isActive:false}).expect(200);
  await api('patch',`/attendance-reasons/${reason.id}`).send({isActive:true}).expect(200);
  await api('delete',`/attendance-reasons/${reason.id}`).expect(200);
  await api('delete',`/programs/${program}`).expect(409);
  await api('patch',`/groups/${groups[0].id}/archive`).send({}).expect(200);
  await api('patch',`/groups/${groups[0].id}/restore`).send({}).expect(200);
  expect((await prisma.group.findUniqueOrThrow({where:{id:groups[0].id}})).isArchived).toBe(false);
 });
 it('creates a login-only account, changes password and blocks refresh',async()=>{
  const user=(await api('post','/users').send({login:`user-${stamp}`,password:'Initial123!',firstName:'Тест',lastName:'Учетная запись'}).expect(201)).body;
  const login=(await request(app.getHttpServer()).post('/api/auth/login').send({login:user.login,password:'Initial123!'}).expect(200)).body;
  const changedProfile=(await api('patch','/auth/profile',login.accessToken).send({firstName:'Обновлён',lastName:'Сотрудник',middleName:'',phone:'+7 900 000-00-00',email:''}).expect(200)).body;
  expect(changedProfile.login).toBe(user.login);expect(changedProfile.firstName).toBe('Обновлён');expect(changedProfile.phone).toBe('+7 900 000-00-00');
  expect((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).passwordHash).toBeTruthy();
  await api('post','/auth/change-password',login.accessToken).send({currentPassword:'Initial123!',newPassword:'Changed123!'}).expect(200);
  await request(app.getHttpServer()).post('/api/auth/refresh').send({refreshToken:login.refreshToken}).expect(401);
  const changed=(await request(app.getHttpServer()).post('/api/auth/login').send({login:user.login,password:'Changed123!'}).expect(200)).body;
  await api('patch',`/users/${user.id}/block`).send({reason:'Тест'}).expect(200);
  await request(app.getHttpServer()).post('/api/auth/refresh').send({refreshToken:changed.refreshToken}).expect(401);
  await api('get','/auth/profile',changed.accessToken).expect(401);
 });
 it('changes a group program without rewriting historical attendance',async()=>{
  const nextProgram=await prisma.educationalProgram.findFirstOrThrow({where:{organizationId:org,id:{not:program}}});
  const oldSnapshot=(await prisma.attendanceRecord.findFirstOrThrow({where:{sheetId:sheets[0].id}})).programSnapshotId;
  await api('patch',`/groups/${groups[0].id}`).send({programId:nextProgram.id}).expect(200);
  expect((await prisma.group.findUniqueOrThrow({where:{id:groups[0].id}})).programId).toBe(nextProgram.id);
  expect((await prisma.student.findUniqueOrThrow({where:{id:students[0].id}})).programId).toBe(nextProgram.id);
  expect((await prisma.attendanceRecord.findFirstOrThrow({where:{sheetId:sheets[0].id}})).programSnapshotId).toBe(oldSnapshot);
 });
});
