import { HttpException, HttpStatus } from '@nestjs/common';

export class AppError extends HttpException {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusOrDetails: number | Record<string, unknown> = HttpStatus.BAD_REQUEST,
    details: Record<string, unknown> = {},
  ) {
    const status = typeof statusOrDetails === 'number' ? statusOrDetails : HttpStatus.BAD_REQUEST;
    const extra = typeof statusOrDetails === 'object' ? statusOrDetails : details;
    super({ error: { code, message, ...(Object.keys(extra).length ? { details: extra } : {}) } }, status);
    this.code = code;
    this.details = extra;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('NOT_FOUND', message, HttpStatus.NOT_FOUND, details);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

export function errorPayload(code: string, message: string, details?: Record<string, unknown>) {
  const body: { error: { code: string; message: string; details?: Record<string, unknown> } } = {
    error: { code, message },
  };
  if (details && Object.keys(details).length) {
    body.error.details = details;
  }
  return body;
}
