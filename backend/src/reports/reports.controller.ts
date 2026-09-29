import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
@Controller('reports') @UseGuards(JwtAuthGuard)
export class ReportsController {
 constructor(private readonly service:ReportsService){}
 @Get('attendance') attendance(@CurrentUser() u:any,@Query() q:any){return this.service.attendance(u,q);}
 @Get('dashboard') dashboard(@CurrentUser() u:any,@Query() q:any){return this.service.getDashboardStats(u.organizationId,u,q);}
 @Get('group/:id') group(@Param('id') id:string,@CurrentUser() u:any,@Query() q:any){return this.service.getGroupReport(id,u,q);}
 @Get('student/:id') student(@Param('id') id:string,@CurrentUser() u:any,@Query() q:any){return this.service.getStudentReport(id,u,q);}
 @Get('summary') summary(@CurrentUser() u:any,@Query() q:any){return this.service.getSummaryReport(u,q);}
}
