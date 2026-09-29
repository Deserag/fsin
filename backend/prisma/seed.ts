import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { updateReferenceData } from './reference-data.js';
const prisma=new PrismaClient();
async function main(){
 if(process.env.NODE_ENV==='production')throw new Error('Демонстрационный seed запрещен в production');
 if(await prisma.organization.count())throw new Error('Seed разрешен только для пустой БД. Для существующей используйте npm run data:update');
 const org=await prisma.organization.create({data:{code:'VIFSIN',name:'Воронежский институт ФСИН России',shortName:'ВИ ФСИН России'}});
 await updateReferenceData(prisma);
 const codes=['STUDENTS_READ','STUDENTS_WRITE','GROUPS_READ','GROUPS_WRITE','ATTENDANCE_READ','ATTENDANCE_WRITE','ATTENDANCE_REVIEW','ATTENDANCE_CLOSE','ATTENDANCE_CORRECT','REPORTS_READ','REPORTS_EXPORT','IMPORT_EXECUTE','USERS_READ','USERS_WRITE','AUDIT_READ','SETTINGS_WRITE','COURSE_TRANSITION'];
 for(const code of codes)await prisma.permission.upsert({where:{code},update:{},create:{code,displayName:({ATTENDANCE_REVIEW:'Проверка табелей',ATTENDANCE_CLOSE:'Закрытие табелей',ATTENDANCE_CORRECT:'Исправление проверенных табелей'} as any)[code]??code,module:code.split('_')[0].toLowerCase()}});
 const permissions=await prisma.permission.findMany();
 const roleDefs=[{name:'admin',displayName:'Администратор',codes},{name:'manager',displayName:'Оперативный дежурный',codes:['STUDENTS_READ','GROUPS_READ','ATTENDANCE_READ','ATTENDANCE_REVIEW','ATTENDANCE_CLOSE','REPORTS_READ','REPORTS_EXPORT']},{name:'foreman',displayName:'Сотрудник УСП',codes:['STUDENTS_READ','GROUPS_READ','ATTENDANCE_READ','ATTENDANCE_WRITE','REPORTS_READ','REPORTS_EXPORT']}];
 const roleIds:Record<string,string>={};
 for(const role of roleDefs){const r=await prisma.role.upsert({where:{name:role.name},update:{displayName:role.displayName},create:{name:role.name,displayName:role.displayName,isSystem:true}});roleIds[role.name]=r.id;for(const code of role.codes){const permission=permissions.find(p=>p.code===code)!;await prisma.rolePermission.upsert({where:{roleId_permissionId:{roleId:r.id,permissionId:permission.id}},update:{},create:{roleId:r.id,permissionId:permission.id}});}}
 const passwordHash=await argon2.hash(process.env.DEMO_PASSWORD??'Admin123!');const users:Record<string,any>={};
 for(const [login,role] of [['admin','admin'],['duty','manager'],['usp1','foreman'],['usp2','foreman']]){users[login]=await prisma.user.create({data:{organizationId:org.id,login,passwordHash,firstName:'Демо',lastName:login,roles:{create:{roleId:roleIds[role]}}}});}
 const yearNumber=new Date().getMonth()<8?new Date().getFullYear()-1:new Date().getFullYear();
 const year=await prisma.academicYear.create({data:{organizationId:org.id,name:`${yearNumber}-${yearNumber+1}`,startDate:new Date(`${yearNumber}-09-01`),endDate:new Date(`${yearNumber+1}-08-31`),isCurrent:true}});
 const programs=await prisma.educationalProgram.findMany({where:{organizationId:org.id},orderBy:{code:'asc'}});
 const studying=await prisma.studentStatus.findFirstOrThrow({where:{organizationId:org.id,code:'STUDYING'}});
 const periods=[];for(const [code,name] of [['MORNING','Утро'],['EVENING','Вечер']])periods.push(await prisma.attendancePeriod.create({data:{organizationId:org.id,code,name,startTime:code==='MORNING'?'08:00':null}}));
 const reason=await prisma.attendanceReason.findFirstOrThrow({where:{organizationId:org.id,code:'ILLNESS'}});
 const start=new Date(`${yearNumber-1}-09-01`);
 for(let g=0;g<6;g++){
  const program=programs[g%programs.length],course=g<3?1:2;
  const group=await prisma.group.create({data:{organizationId:org.id,name:`${course}0${g%3+1}`,programId:program.id,academicYearId:year.id,currentCourse:course}});
  for(const login of ['duty',g%2?'usp2':'usp1'])await prisma.userGroupScope.create({data:{userId:users[login].id,groupId:group.id}});
  await prisma.groupForeman.create({data:{groupId:group.id,userId:users[g%2?'usp2':'usp1'].id}});
  const students=[];
  for(let i=0;i<20;i++)students.push(await prisma.student.create({data:{organizationId:org.id,internalId:`${group.name}-${i+1}`,lastName:`Учебный${String(g*20+i+1).padStart(3,'0')}`,firstName:['Иван','Алексей','Мария','Анна'][i%4],gender:i%4>=2?'FEMALE':'MALE',middleName:'Демонстрационный',enrollmentDate:start,currentGroupId:group.id,academicYearId:year.id,currentCourse:course,programId:program.id,statusId:studying.id,statusHistory:{create:{statusId:studying.id,changeDate:start}},groupHistory:{create:{groupId:group.id,joinDate:start}},courseHistory:{create:{toCourse:course,transitionDate:start}}}}));
  for(let days=1;days<=14;days++)for(const period of periods){const date=new Date(new Date().toISOString().slice(0,10));date.setUTCDate(date.getUTCDate()-days);const status=days===1?'SUBMITTED':days===2?'REVIEWED':days===3?'DRAFT':'CLOSED';const sheet=await prisma.attendanceSheet.create({data:{groupId:group.id,periodId:period.id,date,status,totalCount:20,presentCount:status==='DRAFT'?0:18,absentCount:status==='DRAFT'?0:2,courseSnapshot:course,academicYearSnapshotId:year.id,programSnapshotId:program.id,createdBy:users[g%2?'usp2':'usp1'].id,submittedAt:status==='DRAFT'?null:date,submittedBy:status==='DRAFT'?null:users[g%2?'usp2':'usp1'].id,reviewedAt:['REVIEWED','CLOSED'].includes(status)?date:null,closedAt:status==='CLOSED'?date:null}});await prisma.attendanceRecord.createMany({data:students.map((s,i)=>({sheetId:sheet.id,studentId:s.id,isPresent:status==='DRAFT'?null:i>=2,reasonId:status!=='DRAFT'&&i<2?reason.id:null,courseSnapshot:course,statusSnapshotId:studying.id,programSnapshotId:program.id}))});}
 }
 console.log('Демо: 120 синтетических студентов, 6 групп, история и табели разных статусов. Логины: admin, duty, usp1, usp2.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
