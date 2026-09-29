import {PrismaClient} from '@prisma/client';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const targets=JSON.parse(readFileSync('.verification/targets.json','utf8'));
const before=JSON.parse(readFileSync('.verification/before.json','utf8'));
const prisma=new PrismaClient({datasources:{db:{url:targets.upgrade}}});
const normalize=v=>JSON.parse(JSON.stringify(v));
const report={};
try{
 for(const [table,rows] of Object.entries(before)){
  const after=normalize(await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY 1`));
  const byId=new Map(after.map(r=>[r.id??JSON.stringify(Object.values(r).slice(0,2)),r]));
  for(const row of rows){const next=byId.get(row.id??JSON.stringify(Object.values(row).slice(0,2)));assert.ok(next,`${table}: missing original row`);for(const [key,value]of Object.entries(row)){if(table==='groups'&&key==='programId'&&value===null)continue;if(table==='users'&&key==='login'&&value===row.email&&row.email?.includes('@'))continue;assert.deepEqual(next[key],value,`${table}.${key}: changed existing data`);}}
  report[table]={before:rows.length,after:after.length,preserved:true};
 }
 const invalid=await prisma.user.count({where:{login:''}});assert.equal(invalid,0);
 for(const u of before.users){const now=await prisma.user.findUnique({where:{id:u.id}});assert.ok(now.login);if(u.login===u.email&&u.email?.includes('@'))assert.ok(!now.login.includes('@'));else if(u.login)assert.equal(now.login,u.login);assert.equal(now.passwordHash,u.passwordHash);}
 for(const scope of before.user_direction_scopes??[]){const linked=await prisma.educationalProgram.findMany({where:{directionId:scope.directionId},select:{id:true}});for(const program of linked)assert.ok(await prisma.userProgramScope.findUnique({where:{userId_programId:{userId:scope.userId,programId:program.id}}}),'Legacy direction access was not transferred');}
 const photoCodes=['DUTY_DETAIL','REGIME_POST','INFIRMARY','IN_FORMATION','ZUB','VACATION','HOSPITAL','HOME_TREATMENT','DISMISSAL','BUSINESS_TRIP','WITHOUT_UP','PRACTICE'];
 if(await prisma.organization.count({where:{code:'VIFSIN'}}))assert.equal(await prisma.attendanceReason.count({where:{organization:{code:'VIFSIN'},code:{in:photoCodes}}}),photoCodes.length,'Photo-based attendance categories missing');
 const all=async()=>{const data={};for(const table of ['educational_programs','student_statuses','attendance_reasons','roles','permissions','role_permissions','users','students','groups'])data[table]=normalize(await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY 1`));return data;};
 const first=await all();
 // Run the actual updater a second time through its CLI, keeping the copy URL explicit.
 const {spawnSync}=await import('node:child_process');const result=spawnSync(process.execPath,['scripts/run-verification-command.mjs','upgrade','data'],{stdio:'inherit'});assert.equal(result.status,0);
 assert.deepEqual(await all(),first,'Second reference update must not change records');
 const source=new PrismaClient({datasources:{db:{url:targets.source}}});
 for(const [table,rows]of Object.entries(before))assert.deepEqual(normalize(await source.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY 1`)),rows,`Source ${table} changed`);
 await source.$disconnect();
 writeFileSync('.verification/upgrade-result.json',JSON.stringify({preservation:report,dataUpdateIdempotent:true,sourceUnchanged:true},null,2));
 console.log(JSON.stringify({preservation:report,dataUpdateIdempotent:true,sourceUnchanged:true},null,2));
}finally{await prisma.$disconnect();}
