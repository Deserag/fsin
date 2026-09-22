import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { StudentsService } from './students.service.js';
import { CourseTransitionService } from './course-transition.service.js';
import { CreateStudentDto, UpdateStudentDto, StudentQueryDto } from './dto/student.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly courseTransitionService: CourseTransitionService,
  ) {}

  @Get()
  findAll(@Query() query: StudentQueryDto, @CurrentUser() user: any) {
    return this.studentsService.findAll(user.organizationId, query, user);
  }

  @Get('course-transition/preview')
  @Roles('admin')
  courseTransitionPreview(@CurrentUser('organizationId') orgId: string) {
    return this.courseTransitionService.preview(orgId);
  }

  @Post('course-transition/execute')
  @Roles('admin')
  courseTransitionExecute(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.courseTransitionService.execute(orgId, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.studentsService.findOne(id, orgId);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.studentsService.getHistory(id, orgId);
  }

  @Post()
  @Roles('admin', 'manager')
  create(@Body() dto: CreateStudentDto, @CurrentUser('id') userId: string) {
    return this.studentsService.create(dto, userId);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.studentsService.update(id, orgId, dto, userId);
  }
}
