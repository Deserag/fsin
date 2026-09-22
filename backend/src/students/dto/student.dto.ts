import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  IsUUID,
} from 'class-validator';

export class CreateStudentDto {
  @IsString()
  organizationId: string;

  @IsOptional()
  @IsString()
  internalId?: string;

  @IsString()
  lastName: string;

  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  currentCourse?: number;

  @IsOptional()
  @IsString()
  programId?: string;

  @IsString()
  statusId: string;

  @IsOptional()
  @IsString()
  currentGroupId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  internalId?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  @IsOptional()
  @IsDateString()
  graduationDate?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  currentCourse?: number;

  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsString()
  currentGroupId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class StudentQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  currentCourse?: number;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsString()
  directionId?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

export class CourseTransitionPreviewDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsDateString()
  transitionDate?: string;
}

export class CourseTransitionExecuteDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsDateString()
  transitionDate?: string;

  @IsBoolean()
  confirmed: boolean;
}
