import type { PermissionCode } from '../constants/permissions';

export type AnyJsonValue =
  | null
  | string
  | number
  | boolean
  | AnyJsonValue[]
  | { [key: string]: AnyJsonValue };

export interface EnvelopeBase<T = unknown> {
  requestId: string;
  code: number;
  message: string;
  data: T;
}

export interface PagedMeta<T> {
  pageNo: number;
  pageSize: number;
  total: number;
  items: T[];
}

export interface CurrentUserContext {
  userId: string;
  tenantId: string;
  displayName: string;
  email: string;
  roleCodes: string[];
  permissions: PermissionCode[];
}

