import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';
import { CourseTransitionService } from './course-transition.service.js';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, CourseTransitionService],
  exports: [StudentsService],
})
export class StudentsModule {}
