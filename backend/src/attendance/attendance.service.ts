import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { groupScope, assertGroup, requirePermission } from '../auth/scope.js';
import { rosterInclude, stateOnDate } from './roster.js';

@Injectable()
export class AttendanceService {
 constructor(private readonly prisma: PrismaService) {}
 private transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return typeof (this.prisma as any).$transaction === 'function' ? this.prisma.$transaction(work, { timeout: 30000 }) : work(this.prisma);
 }
 private date(value: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) throw new BadRequestException('Укажите дату');
  const day = value.slice(0,10), date = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0,10) !== day) throw new BadRequestException('Некорректная дата');
  return date;
 }
 async findSheets(organizationId: string, user: any, q: any) {
  requirePermission(user, 'ATTENDANCE_READ');
  const page = Math.max(1, Number(q.page)||1), limit = Math.min(500, Math.max(1, Number(q.limit)||100));
  const where: any = { group: groupScope(user), ...(q.groupId && { groupId: q.groupId }), ...(q.periodId && { periodId: q.periodId }), ...(q.status && { status: q.status }),
   ...(q.course && { courseSnapshot: Number(q.course) }), ...(q.academicYearId && { academicYearSnapshotId: q.academicYearId }),
   ...((q.dateFrom || q.dateTo) && { date: { ...(q.dateFrom && { gte: this.date(q.dateFrom) }), ...(q.dateTo && { lt: new Date(+this.date(q.dateTo)+86400000) }) } }) };
  const [data,total] = await Promise.all([this.prisma.attendanceSheet.findMany({ where, include: { group: true, period: true }, orderBy: [{date:'desc'},{group:{name:'asc'}}], take:limit, skip:(page-1)*limit }),this.prisma.attendanceSheet.count({where})]);
  const authors = await this.prisma.user.findMany({ where: { organizationId, id: { in: data.map(s=>s.submittedBy ?? s.createdBy).filter(Boolean) as string[] } }, select: { id:true, firstName:true,lastName:true } });
  return { data: data.map(s=>({...s, author: authors.find(u=>u.id === (s.submittedBy ?? s.createdBy)) ?? null})), meta:{total,page,limit,totalPages:Math.ceil(total/limit)} };
 }
 async findOneSheet(id: string, user: any) {
  requirePermission(user, 'ATTENDANCE_READ');
  const sheet = await this.prisma.attendanceSheet.findUnique({ where:{id}, include:{group:true,period:true,records:{ include:{student:{select:{id:true,firstName:true,lastName:true,middleName:true,gender:true}},reason:true,fieldValues:{include:{field:true}}},orderBy:{student:{lastName:'asc'}} }} });
  if (!sheet) throw new NotFoundException('Табель не найден');
  assertGroup(sheet.group,user); return sheet;
 }
 async createSheet(dto: any, user: any) {
  requirePermission(user,'ATTENDANCE_WRITE');
  return this.transaction(async tx => {
   const group = await tx.group.findUnique({ where:{id:dto.groupId} });
   if (!group) throw new NotFoundException('Группа не найдена');
   assertGroup(group,user);
   if (group.isArchived || !group.isActive) throw new BadRequestException('Группа в архиве');
   const period = await tx.attendancePeriod.findFirst({where:{id:dto.periodId,organizationId:user.organizationId,isActive:true}});
   if (!period) throw new BadRequestException('Период недоступен');
   const date = this.date(dto.date);
   const existing = await tx.attendanceSheet.findFirst({where:{groupId:group.id,periodId:period.id,date}});
   if (existing) throw new BadRequestException('Табель для этой группы, периода и даты уже существует');
   const candidates = await tx.student.findMany({where:{organizationId:user.organizationId,groupHistory:{some:{groupId:group.id}}},include:rosterInclude});
   const roster = candidates.map(st=>({student:st,state:stateOnDate(st,date)})).filter(r=>r.state.eligible && r.state.groupId===group.id);
   const courses = [...new Set(roster.map(r=>r.state.course))];
   const sheet = await tx.attendanceSheet.create({data:{groupId:group.id,periodId:period.id,date,createdBy:user.id,totalCount:roster.length,
    courseSnapshot:courses.length===1 ? courses[0] : group.currentCourse,programSnapshotId:group.programId,academicYearSnapshotId:group.academicYearId},include:{group:true,period:true}});
   if(roster.length) await tx.attendanceRecord.createMany({data:roster.map(r=>({sheetId:sheet.id,studentId:r.student.id,isPresent:null,courseSnapshot:r.state.course,statusSnapshotId:r.state.status.id,programSnapshotId:group.programId ?? r.student.programId}))});
   await tx.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:'CREATE',entityType:'AttendanceSheet',entityId:sheet.id,newValue:{groupId:group.id,date:date.toISOString(),totalCount:roster.length}}});
   return sheet;
  });
 }
 async updateRecord(sheetId:string,studentId:string,dto:any,user:any) { return this.bulkUpdateRecords(sheetId,[{...dto,studentId}],user); }
 async bulkUpdateRecords(sheetId:string,updates:any[],user:any) {
  requirePermission(user,'ATTENDANCE_WRITE');
  if (!Array.isArray(updates) || updates.length > 1000) throw new BadRequestException('Неверный список отметок');
  return this.transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM attendance_sheets WHERE id = ${sheetId} FOR UPDATE`;
   const service = new AttendanceService(tx as PrismaService), sheet = await service.findOneSheet(sheetId,user);
   const protectedSheet = ['SUBMITTED','REVIEWED','CLOSED'].includes(sheet.status);
   if (protectedSheet && !user.roles.includes('admin') && !user.permissions?.includes('ATTENDANCE_CORRECT')) throw new ForbiddenException('Табель отправлен или закрыт. Требуется право административного исправления');
   const before:any[]=[];
   for(const update of updates) {
    const record = sheet.records.find(r=>r.studentId===update.studentId);
    if (!record) throw new BadRequestException('Студент не входит в состав этого табеля');
    if (typeof update.isPresent !== 'boolean') throw new BadRequestException('Укажите явку');
    if (!update.isPresent && !update.reasonId) throw new BadRequestException('При отметке отсутствия необходимо указать причину');
    if (update.reasonId) {
     const reason = await tx.attendanceReason.findFirst({where:{id:update.reasonId,organizationId:user.organizationId,isActive:true}});
     if (!reason) throw new BadRequestException('Причина недоступна');
     if (reason.category !== (update.isPresent ? 'IN_INSTITUTE' : 'OUTSIDE')) throw new BadRequestException('Категория не соответствует положению студента');
     if (reason.requiresNote && !update.note?.trim()) throw new BadRequestException('Для этой причины необходим комментарий');
    }
    before.push({studentId:record.studentId,isPresent:record.isPresent,reasonId:record.reasonId,note:record.note});
    await tx.attendanceRecord.update({where:{id:record.id},data:{isPresent:update.isPresent,reasonId:update.reasonId ?? null,note:update.note ?? null,markedBy:user.id,markedAt:new Date()}});
   }
   const records = await tx.attendanceRecord.findMany({where:{sheetId}});
   const presentCount = records.filter(r=>r.isPresent===true).length, absentCount = records.filter(r=>r.isPresent===false).length;
   await tx.attendanceSheet.update({where:{id:sheetId},data:{presentCount,absentCount,...(!protectedSheet && {status:presentCount+absentCount===sheet.totalCount ? 'FILLED' : 'DRAFT'})}});
   await tx.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:protectedSheet?'ADMIN_CORRECTION':'UPDATE',entityType:'AttendanceSheet',entityId:sheetId,oldValue:before,newValue:updates}});
   return {updated:updates.length};
  });
 }
 async getSheetValidation(id:string,user:any) {
  const sheet=await this.findOneSheet(id,user);
  const presentCount=sheet.records.filter(r=>r.isPresent===true).length, absentCount=sheet.records.filter(r=>r.isPresent===false).length;
  const invalid=sheet.records.filter(r=>r.isPresent===false && (!r.reasonId || (r.reason?.requiresNote && !r.note?.trim())));
  const missing=sheet.records.filter(r=>r.isPresent===null);
  const names=(records:any[])=>records.map(r=>({studentId:r.studentId,studentName:`${r.student.lastName} ${r.student.firstName}`}));
  return {totalStudents:sheet.totalCount,totalMarked:presentCount+absentCount,presentCount,absentCount,unmarked:sheet.totalCount-presentCount-absentCount,unmarkedStudents:names(missing),absentWithoutReasonCount:invalid.length,absentWithoutReason:names(invalid),isComplete:presentCount+absentCount===sheet.totalCount,isValid:presentCount+absentCount===sheet.totalCount&&!invalid.length};
 }
 private async transition(id:string,action:string,user:any,comment?:string) {
  requirePermission(user,action==='submit'?'ATTENDANCE_WRITE':action==='close'?'ATTENDANCE_CLOSE':'ATTENDANCE_REVIEW');
  return this.transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM attendance_sheets WHERE id = ${id} FOR UPDATE`;
   const service=new AttendanceService(tx as PrismaService),sheet=await service.findOneSheet(id,user);
   const allowed=action==='submit'?['DRAFT','FILLED']:action==='close'?['REVIEWED']:['SUBMITTED'];
   if(!allowed.includes(sheet.status)) throw new BadRequestException('Переход недоступен для текущего статуса табеля');
   if(action==='submit') { const v=await service.getSheetValidation(id,user); if(!v.isValid) throw new BadRequestException({message:'Не все студенты отмечены или указаны причины отсутствия',...v}); }
   if(action==='return'&&!comment?.trim()) throw new BadRequestException('Укажите причину возврата');
   const now=new Date();
   const data:any=action==='submit'?{status:'SUBMITTED',submittedBy:user.id,submittedAt:now,returnComment:null}:action==='review'?{status:'REVIEWED',reviewedBy:user.id,reviewedAt:now}:action==='close'?{status:'CLOSED',closedBy:user.id,closedAt:now}:{status:'DRAFT',returnComment:comment,reviewedBy:user.id,reviewedAt:now};
   await tx.attendanceSheet.update({where:{id},data});
   await tx.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:action.toUpperCase(),entityType:'AttendanceSheet',entityId:id,oldValue:{status:sheet.status},newValue:{status:data.status,comment:comment??null}}});
   return {message:action==='return'?'Табель возвращён на доработку':'Статус табеля обновлён'};
  });
 }
 submitSheet(id:string,u:any){return this.transition(id,'submit',u);}
 reviewSheet(id:string,u:any){return this.transition(id,'review',u);}
 closeSheet(id:string,u:any){return this.transition(id,'close',u);}
 returnSheet(id:string,u:any,comment:string){return this.transition(id,'return',u,comment);}
 async courseSheets(dto:any,user:any,create=false) {
  requirePermission(user,create?'ATTENDANCE_WRITE':'ATTENDANCE_READ');
  if(!dto.academicYearId || !Number.isInteger(Number(dto.course)) || Number(dto.course)<1 || Number(dto.course)>10) throw new BadRequestException('Укажите учебный год и курс');
  const date=this.date(dto.date);
  const groups=await this.prisma.group.findMany({where:{...groupScope(user),academicYearId:dto.academicYearId,currentCourse:Number(dto.course),isActive:true,isArchived:false},orderBy:{name:'asc'}});
  const sheets=await this.prisma.attendanceSheet.findMany({where:{group:groupScope(user),academicYearSnapshotId:dto.academicYearId,courseSnapshot:Number(dto.course),date,periodId:dto.periodId},orderBy:{group:{name:'asc'}}});
  const ids=sheets.map(s=>s.id);
  for(const group of groups) if(!sheets.some(s=>s.groupId===group.id) && create) ids.push((await this.createSheet({groupId:group.id,periodId:dto.periodId,date:dto.date},user)).id);
  return Promise.all(ids.map(id=>this.findOneSheet(id,user)));
 }
 async openCourse(dto:any,user:any) {
  return this.transaction(async tx=>new AttendanceService(tx as PrismaService).courseSheets(dto,user,true));
 }
 async courseAction(dto:any,user:any) {
  return this.transaction(async tx=>{
   const service=new AttendanceService(tx as PrismaService),sheets=await service.courseSheets(dto,user,false);
   if(!sheets.length) throw new BadRequestException('Табели курса не созданы');
   const groups=await tx.group.findMany({where:{...groupScope(user),academicYearId:dto.academicYearId,currentCourse:Number(dto.course),isActive:true,isArchived:false}});
   if(dto.action==='submit' && groups.some(g=>!sheets.some(s=>s.groupId===g.id))) throw new BadRequestException('Создайте табели всех доступных групп курса');
   if(!['submit','review','close','return'].includes(dto.action)) throw new BadRequestException('Неизвестное действие');
   const actionable = dto.action==='submit' ? sheets : sheets.filter(s=>s.status===(dto.action==='close'?'REVIEWED':'SUBMITTED'));
   if (!actionable.length) throw new BadRequestException('Нет табелей в подходящем статусе');
   for(const sheet of [...actionable].sort((a,b)=>a.id.localeCompare(b.id))) await service.transition(sheet.id,dto.action,user,dto.comment);
   return {updated:actionable.length};
  });
 }
}
