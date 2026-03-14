import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response, Request } from 'express';
import { ERROR_CODES } from '@lobster-park/shared';
import { ApiError } from './api-error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = response.getHeader('x-request-id') || request.headers['x-request-id'] || randomUUID();

    if (exception instanceof ApiError) {
      response.status(exception.status).json({
        requestId,
        code: exception.code,
        message: exception.message,
        data: exception.data ?? null
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json({
        requestId,
        code: ERROR_CODES.tooManyRequests,
        message: exception.message,
        data: exception.getResponse()
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      requestId,
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception instanceof Error ? exception.message : 'Internal server error',
      data: null
    });
  }
}

