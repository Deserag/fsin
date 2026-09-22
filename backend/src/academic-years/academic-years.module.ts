import { Module } from '@nestjs/common';
import { AcademicYearsController } from './academic-years.controller.js';
import { AcademicYearsService } from './academic-years.service.js';
@Module({ controllers: [AcademicYearsController], providers: [AcademicYearsService] })
export class AcademicYearsModule {}
