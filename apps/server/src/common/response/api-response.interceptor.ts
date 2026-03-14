import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.decorator';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  private readonly reflector = new Reflector();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const skipEnvelope = this.reflector.get<boolean>(SKIP_ENVELOPE_KEY, handler);
    const response = context.switchToHttp().getResponse<{ getHeader: (name: string) => string | undefined }>();
    const requestId = response.getHeader('x-request-id') ?? '';

    if (skipEnvelope) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        requestId,
        code: 0,
        message: 'ok',
        data
      }))
    );
  }
}

