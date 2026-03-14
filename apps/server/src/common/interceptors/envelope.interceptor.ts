import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      map((data) => ({
        requestId: request.requestId || request.headers['x-request-id'] || 'unknown',
        code: 0,
        message: 'ok',
        data
      }))
    );
  }
}
