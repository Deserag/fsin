import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.module.js';
import { StudentsModule } from './students/students.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { DirectionsModule } from './directions/directions.module.js';
import { ProgramsModule } from './programs/programs.module.js';
import { AcademicYearsModule } from './academic-years/academic-years.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AttendanceReasonsModule } from './attendance-reasons/attendance-reasons.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { ImportsModule } from './imports/imports.module.js';
import { ExportsModule } from './exports/exports.module.js';
import { AuditModule } from './audit/audit.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { SettingsModule } from './settings/settings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    StudentsModule,
    GroupsModule,
    DirectionsModule,
    ProgramsModule,
    AcademicYearsModule,
    AttendanceModule,
    AttendanceReasonsModule,
    ReportsModule,
    ImportsModule,
    ExportsModule,
    AuditModule,
    OrganizationModule,
    SettingsModule,
  ],
})
export class AppModule {}
