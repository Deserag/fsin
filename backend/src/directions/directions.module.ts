import { Module } from '@nestjs/common';
import { DirectionsController } from './directions.controller.js';
import { DirectionsService } from './directions.service.js';
@Module({ controllers: [DirectionsController], providers: [DirectionsService], exports: [DirectionsService] })
export class DirectionsModule {}
