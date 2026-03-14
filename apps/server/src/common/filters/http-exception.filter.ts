import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ErrorCodes } from '../errors/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : { message: 'Internal server error' };
    const message = typeof body === 'object' && body && 'message' in body ? (body as { message: string }).message : 'Request failed';
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const requestId = request.requestId || request.headers['x-request-id'] || 'unknown';
      const route = `${request.method ?? 'UNKNOWN'} ${request.originalUrl ?? request.url ?? ''}`.trim();
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${route} failed (${requestId}): ${message}`, stack);
    }
    response.status(status).json({
      requestId: request.requestId || request.headers['x-request-id'] || 'unknown',
      code: status === 429 ? ErrorCodes.RATE_LIMITED : status,
      message,
      data: typeof body === 'object' ? body : { detail: body }
    });
  }
}
