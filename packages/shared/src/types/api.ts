export interface EnvelopeBase<T = unknown> {
  requestId: string;
  code: number;
  message: string;
  data: T;
}

export interface PagedMeta {
  pageNo: number;
  pageSize: number;
  total: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export interface SelectOption {
  label: string;
  value: string;
}
