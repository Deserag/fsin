import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { groupScope, requirePermission } from '../auth/scope.js';
@Injectable()
export class ReportsService {
 constructor(private readonly prisma: PrismaService) {}
 filters(user:any,q:any):any {
  const list=(v:any)=>v ? String(v).split(',').filter(Boolean) : undefined;
  const from=q.from??q.dateFrom, to=q.to??q.dateTo;
  const date=(s:string)=>{const d=new Date(s);if(!Number.isFinite(+d))throw new BadRequestException('Неверная дата отчета');return d;};
  if(from&&to&&date(from)>date(to))throw new BadRequestException('Начало периода позже окончания');
  const course=Number(q.course??q.courseNumber);
  if((q.course||q.courseNumber)&&(!Number.isInteger(course)||course<1||course>10))throw new BadRequestException('Неверный курс');
  return { ...(q.studentId&&{studentId:q.studentId}), ...(course&&{courseSnapshot:course}), ...(q.program&&{programSnapshotId:{in:list(q.program)}}), ...(q.statusId&&{statusSnapshotId:q.statusId}), ...(q.reasonId&&{reasonId:q.reasonId}),
   sheet:{group:groupScope(user),...((q.group||q.groupId)&&{groupId:{in:list(q.group??q.groupId)}}),...(q.periodId&&{periodId:q.periodId}),...(q.academicYearId&&{academicYearSnapshotId:q.academicYearId}),...((from||to)&&{date:{...(from&&{gte:date(from)}),...(to&&{lt:new Date(+date(to)+86400000)})}})} };
 }
 async attendance(user:any,q:any,permission='REPORTS_READ') {
  requirePermission(user,permission);
  const where=this.filters(user,q);
  // SQL aggregation runs in PostgreSQL; individual attendance rows are not shipped to the browser.
  const buckets=await this.prisma.attendanceRecord.groupBy({by:['sheetId','isPresent','reasonId','courseSnapshot'],where,_count:true});
  const sheetIds=[...new Set(buckets.map(b=>b.sheetId))];
  const [sheets,reasons]=await Promise.all([this.prisma.attendanceSheet.findMany({where:{id:{in:sheetIds}},include:{group:true,period:true}}),this.prisma.attendanceReason.findMany({where:{organizationId:user.organizationId}})]);
  const sheetMap=new Map(sheets.map(s=>[s.id,s])), reasonMap=new Map(reasons.map(r=>[r.id,r.name]));
  const make=()=>({total:0,present:0,absent:0,unmarked:0,attendanceRate:0});
  const summary=make(),daily=new Map<string,any>(),groups=new Map<string,any>(),courses=new Map<string,any>(),breakdown=new Map<string,any>();
  const add=(target:any,b:any)=>{target.total+=b._count;if(b.isPresent===true)target.present+=b._count;else if(b.isPresent===false)target.absent+=b._count;else target.unmarked+=b._count;target.attendanceRate=target.present+target.absent?Math.round(target.present/(target.present+target.absent)*1000)/10:0;};
  for(const b of buckets){const sheet=sheetMap.get(b.sheetId)!;const day=sheet.date.toISOString().slice(0,10),course=String(b.courseSnapshot??'unknown');
   if(!daily.has(day))daily.set(day,{date:day,...make()});
   if(!groups.has(sheet.groupId))groups.set(sheet.groupId,{id:sheet.groupId,name:sheet.group.name,...make()});
   if(!courses.has(course))courses.set(course,{course:b.courseSnapshot,...make()});
   for(const target of [summary,daily.get(day),groups.get(sheet.groupId),courses.get(course)])add(target,b);
   if(b.isPresent===false){const key=b.reasonId??'unknown';if(!breakdown.has(key))breakdown.set(key,{id:key,name:reasonMap.get(key)??'Без причины',count:0});breakdown.get(key).count+=b._count;}
  }
  const students=q.group||q.groupId||q.studentId ? await this.prisma.attendanceRecord.groupBy({by:['studentId','courseSnapshot','statusSnapshotId','isPresent'],where,_count:true}):[];
  const names=students.length?await this.prisma.student.findMany({where:{id:{in:[...new Set(students.map(s=>s.studentId))]}},select:{id:true,firstName:true,lastName:true,middleName:true}}):[];
  const studentMap=new Map<string,any>();
  for(const b of students){const key=`${b.studentId}:${b.courseSnapshot}:${b.statusSnapshotId}`;if(!studentMap.has(key)){const s=names.find(s=>s.id===b.studentId)!;studentMap.set(key,{id:key,studentId:b.studentId,name:`${s.lastName} ${s.firstName} ${s.middleName??''}`,course:b.courseSnapshot,statusId:b.statusSnapshotId,...make()});}add(studentMap.get(key),b);}
  return {summary,daily:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),groups:[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)),courses:[...courses.values()],reasons:[...breakdown.values()],students:[...studentMap.values()],unknownHistoryCount:buckets.filter(b=>b.courseSnapshot===null).reduce((a,b)=>a+b._count,0)};
 }
 async getGroupReport(id:string,user:any,q:any){const report=await this.attendance(user,{...q,group:id});return {...report,group:report.groups[0]??null,summary:{...report.summary,totalRecords:report.summary.total,presentRecords:report.summary.present,absentRecords:report.summary.absent,reasonBreakdown:Object.fromEntries(report.reasons.map(r=>[r.name,r.count]))}};}
 getStudentReport(id:string,user:any,q:any){return this.attendance(user,{...q,studentId:id});}
 async getSummaryReport(user:any,q:any){const report=await this.attendance(user,q);return {...report,totals:{groupCount:report.groups.length,totalRecords:report.summary.total,presentRecords:report.summary.present,absentRecords:report.summary.absent,avgAttendanceRate:report.summary.attendanceRate}};}
 async getDashboardStats(organizationId:string,user:any,q:any={}) {
  requirePermission(user,'ATTENDANCE_READ');
  const scope=groupScope(user),today=new Date(new Date().toISOString().slice(0,10));
  const [studentCount,groupCount,periodCount,todaySheets,pendingCount,analytics]=await Promise.all([
   this.prisma.student.count({where:{organizationId,isActive:true,status:{isTerminal:false,countsInAttendance:true},currentGroup:scope}}),
   this.prisma.group.count({where:{...scope,isActive:true,isArchived:false}}),this.prisma.attendancePeriod.count({where:{organizationId,isActive:true}}),
   this.prisma.attendanceSheet.findMany({where:{group:scope,date:{gte:today,lt:new Date(+today+86400000)}},include:{group:true,period:true}}),
   this.prisma.attendanceSheet.count({where:{group:scope,status:'SUBMITTED'}}),this.attendance(user,q,'ATTENDANCE_READ')]);
  return {studentCount,groupCount,pendingCount,absentToday:todaySheets.reduce((a,s)=>a+s.absentCount,0),unfilledSheetsToday:Math.max(0,groupCount*periodCount-todaySheets.length)+todaySheets.filter(s=>s.status==='DRAFT').length,todaySheets,analytics};
 }
}
