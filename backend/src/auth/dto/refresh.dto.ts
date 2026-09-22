import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Новый пароль должен содержать минимум 8 символов' })
  newPassword: string;
}
