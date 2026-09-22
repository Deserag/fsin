import { Module } from '@nestjs/common';
import { AttendanceReasonsController } from './attendance-reasons.controller.js';
import { AttendanceReasonsService } from './attendance-reasons.service.js';
@Module({ controllers: [AttendanceReasonsController], providers: [AttendanceReasonsService] })
export class AttendanceReasonsModule {}
