import { PrismaClient } from '@prisma/client';
import { updateRosterReferenceData } from './roster-reference-data.js';
// Codes and names: 2025 admission notice, Aksay administration.
// Durations/forms: official education committee notice, https://kobmr.ru/hrpolitics/5544/.
// The 2026 admission plan could not be verified; these are not advertised as a complete 2026 list.
export const programs = [
 {code:'11.05.04',name:'Инфокоммуникационные технологии и системы специальной связи',shortName:'ИТ',durationYears:5,maxCourse:5,educationForm:'Очная'},
 {code:'10.05.02',name:'Информационная безопасность телекоммуникационных систем',shortName:'ИБ',durationYears:5,maxCourse:5,educationForm:'Очная',specialization:'Техническая защита информации и информационно-телекоммуникационных систем'},
 {code:'40.03.01',name:'Юриспруденция',shortName:'ЮР',durationYears:4,maxCourse:4,educationForm:'Очная'},
];
export const statuses = [
 {code:'STUDYING',name:'Обучается',isTerminal:false,countsInAttendance:true},
 {code:'ACADEMIC_LEAVE',name:'Академический отпуск',isTerminal:false,countsInAttendance:false},
 {code:'EXPELLED',name:'Отчислен',isTerminal:true,countsInAttendance:false},
 {code:'TRANSFERRED',name:'Переведен',isTerminal:true,countsInAttendance:false},
 {code:'GRADUATED',name:'Обучение завершено',isTerminal:true,countsInAttendance:false},
];
export const reasons = [
 {code:'ILLNESS',name:'Болезнь'}, {code:'VACATION',name:'Отпуск'}, {code:'SERVICE',name:'Служебная необходимость'}, {code:'OTHER',name:'Другое',requiresNote:true},
];
export async function updateReferenceData(prisma:PrismaClient) {
 const organizations=await prisma.organization.findMany({where:{code:'VIFSIN'}});
 for(const org of organizations) await prisma.$transaction(async tx=>{
  // Serialize reruns, including concurrent invocations. Never rename user-maintained records or reassign students.
  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${org.id} FOR UPDATE`;
  for(const p of programs) await tx.educationalProgram.upsert({where:{organizationId_code:{organizationId:org.id,code:p.code}},update:{},create:{organizationId:org.id,...p,sourceUrl:'https://kobmr.ru/hrpolitics/5544/',description:'Подтверждено по открытым сведениям 2025/26; набор 2026 отдельно не подтвержден'}});
  for(const [sortOrder,s] of statuses.entries()) await tx.studentStatus.upsert({where:{organizationId_code:{organizationId:org.id,code:s.code}},update:{},create:{organizationId:org.id,...s,sortOrder}});
  for(const [sortOrder,r] of reasons.entries()) await tx.attendanceReason.upsert({where:{organizationId_code:{organizationId:org.id,code:r.code}},update:{},create:{organizationId:org.id,...r,sortOrder}});
  await updateRosterReferenceData(tx, org.id);
 });
 return {organizations:organizations.length};
}
