import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class CurrentUserMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    req.currentUser = await this.authService.resolveRequestUser(req);
    next();
  }
}
