import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
 catch(error: any, host: ArgumentsHost) {
  const code = error.code;
  const status = code === 'P2025' ? 404 : code === 'P2002' || code === 'P2003' ? 409 : 400;
  const message = code === 'P2002' ? 'Запись с таким кодом, логином или названием уже существует' : code === 'P2003' ? 'Запись используется. Вместо удаления архивируйте её' : code === 'P2025' ? 'Запись не найдена' : 'Проверьте формат и обязательные поля';
  host.switchToHttp().getResponse().status(status).json({ statusCode: status, message });
 }
}
