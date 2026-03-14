import type { RequestUserContext } from '../common/auth/access-control';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      currentUser?: RequestUserContext | null;
    }
  }
}

export {};
