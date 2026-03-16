import { API_BASE_URL, apiRequest } from './client';

export type SkillPackageAdmin = {
  id: string;
  sourceType: string;
  sourceUri: string;
  version: string;
  reviewStatus: string;
  riskLevel: string;
  tenantPolicyEffect?: string;
  metadataJson?: Record<string, unknown>;
  contentJson?: unknown;
  hasContent?: boolean;
  hasStoragePath?: boolean;
  packageSize?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateSkillRequest = {
  name: string;
  description?: string;
  version: string;
  sourceType?: string;
  riskLevel?: string;
  contentJson?: unknown;
};

export type UpdateSkillRequest = {
  name?: string;
  description?: string;
  version?: string;
  riskLevel?: string;
  reviewStatus?: string;
  tenantPolicyEffect?: string;
  contentJson?: unknown;
};

type PagedResult<T> = {
  pageNo: number;
  pageSize: number;
  total: number;
  items: T[];
};

/** 管理员：获取技能列表 */
export async function listSkillsAdmin(pageNo = 1, pageSize = 20) {
  return apiRequest<PagedResult<SkillPackageAdmin>>(`${API_BASE_URL}/platform/skills?pageNo=${pageNo}&pageSize=${pageSize}`);
}

/** 管理员：获取技能详情（含解密内容） */
export async function getSkillAdmin(skillId: string) {
  return apiRequest<SkillPackageAdmin>(`${API_BASE_URL}/platform/skills/${skillId}`);
}

/** 管理员：创建技能（表单方式） */
export async function createSkill(body: CreateSkillRequest) {
  return apiRequest<SkillPackageAdmin>(`${API_BASE_URL}/platform/skills`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 管理员：更新技能 */
export async function updateSkill(skillId: string, body: UpdateSkillRequest) {
  return apiRequest<SkillPackageAdmin>(`${API_BASE_URL}/platform/skills/${skillId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** 管理员：删除技能 */
export async function deleteSkill(skillId: string) {
  return apiRequest<{ deleted: boolean; skillId: string }>(`${API_BASE_URL}/platform/skills/${skillId}`, {
    method: 'DELETE',
  });
}

/** 管理员：上传 ZIP 技能包 */
export async function uploadSkillPackage(file: File, skillId?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (skillId) formData.append('skillId', skillId);

  const response = await fetch(`${API_BASE_URL}/platform/skills/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`上传失败: ${response.status}`);
  }

  return response.json();
}
