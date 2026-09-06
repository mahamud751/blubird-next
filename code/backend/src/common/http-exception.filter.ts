import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppError, errorPayload } from './errors';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppError) {
      const body = exception.getResponse();
      return response.status(exception.getStatus()).json(body);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      if (typeof raw === 'object' && raw && 'error' in (raw as object)) {
        return response.status(status).json(raw);
      }
      const message =
        typeof raw === 'string'
          ? raw
          : Array.isArray((raw as { message?: unknown }).message)
            ? ((raw as { message: string[] }).message).join('; ')
            : String((raw as { message?: string }).message || exception.message);
      const code = status === HttpStatus.UNPROCESSABLE_ENTITY || status === HttpStatus.BAD_REQUEST
        ? 'VALIDATION_ERROR'
        : 'HTTP_ERROR';
      return response.status(status === HttpStatus.BAD_REQUEST ? HttpStatus.UNPROCESSABLE_ENTITY : status).json(
        errorPayload(code, message),
      );
    }

    this.logger.error(exception);
    return response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorPayload('INTERNAL', 'unexpected error'));
  }
}
