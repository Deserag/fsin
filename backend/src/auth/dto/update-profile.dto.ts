import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsString() @MinLength(1) @MaxLength(100) firstName: string;
  @IsString() @MinLength(1) @MaxLength(100) lastName: string;
  @IsOptional() @IsString() @MaxLength(100) middleName?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @ValidateIf((_, value) => value !== '' && value !== null && value !== undefined) @IsEmail() @MaxLength(255) email?: string;
}
