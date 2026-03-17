import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SkillCryptoService } from './skill-crypto.service';
import { SkillStorageService } from './skill-storage.service';

/** 不返回给普通用户的敏感字段 */
const SENSITIVE_FIELDS = ['contentJson', 'contentHash', 'contentStoragePath'] as const;

function stripSensitive<T extends Record<string, unknown>>(item: T): Omit<T, 'contentJson' | 'contentHash' | 'contentStoragePath'> {
  const result = { ...item };
  for (const field of SENSITIVE_FIELDS) {
    delete (result as Record<string, unknown>)[field];
  }
  return result;
}

export type CreateSkillInput = {
  name: string;
  description?: string;
  version: string;
  sourceType: string;
  riskLevel?: string;
  contentJson?: unknown;
};

export type UpdateSkillInput = {
  name?: string;
  description?: string;
  version?: string;
  riskLevel?: string;
  reviewStatus?: string;
  tenantPolicyEffect?: string;
  contentJson?: unknown;
};

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly auditService: AuditService,
    private readonly crypto: SkillCryptoService,
    private readonly storage: SkillStorageService,
  ) {}

  // ──────────────────────────── 普通用户查询（过滤敏感字段） ────────────────────────────

  async listSkillsPublic(pageNo = 1, pageSize = 20) {
    const take = pageSize;
    const skip = (pageNo - 1) * take;
    const [total, items] = await Promise.all([
      this.prisma.skillPackage.count(),
      this.prisma.skillPackage.findMany({ orderBy: { createdAt: 'asc' }, skip, take }),
    ]);
    return { pageNo, pageSize: take, total, items: items.map(stripSensitive) };
  }

  async listInstanceSkills(currentUser: RequestUserContext, instanceId: string, pageNo = 1, pageSize = 50) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [packages, bindings] = await Promise.all([
      this.prisma.skillPackage.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.instanceSkillBinding.findMany({ where: { instanceId } }),
    ]);
    const enabledMap = new Map(bindings.map((binding) => [binding.skillId, binding.enabled]));
    const items = packages.map((item) => ({ ...stripSensitive(item), enabled: enabledMap.get(item.id) ?? false }));
    return { pageNo, pageSize, total: items.length, items };
  }

  async setInstanceSkillEnabled(currentUser: RequestUserContext, instanceId: string, skillId: string, enabled: boolean) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const skill = await this.prisma.skillPackage.findUnique({ where: { id: skillId } });
    if (!skill) throw new NotFoundException('skill not found');
    const binding = await this.prisma.instanceSkillBinding.upsert({
      where: { instanceId_skillId: { instanceId, skillId } },
      update: { enabled, updatedBy: currentUser.id },
      create: {
        id: `skb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        instanceId,
        skillId,
        enabled,
        createdBy: currentUser.id,
        updatedBy: currentUser.id,
      },
    });
    await this.auditService.record({
      tenantId: currentUser.tenantId,
      actionType: enabled ? 'skill.enabled' : 'skill.disabled',
      actionResult: 'success',
      operatorUserId: currentUser.id,
      targetType: 'instance_skill',
      targetId: `${instanceId}:${skillId}`,
      summary: `${enabled ? 'Enabled' : 'Disabled'} skill on instance`,
      riskLevel: 'medium',
      afterJson: { instanceId, skillId, enabled },
    });
    return { enabled: binding.enabled, instanceId, skillId };
  }

  // ──────────────────────────── 管理员 CRUD ────────────────────────────

  async listSkillsAdmin(pageNo = 1, pageSize = 20) {
    const take = pageSize;
    const skip = (pageNo - 1) * take;
    const [total, items] = await Promise.all([
      this.prisma.skillPackage.count(),
      this.prisma.skillPackage.findMany({ orderBy: { createdAt: 'asc' }, skip, take }),
    ]);
    // 管理员可以看到所有字段，但 contentJson 返回是否有内容的标记而非原始密文
    const safeItems = items.map((item) => ({
      ...item,
      contentJson: item.contentJson ? { _encrypted: true } : null,
      hasContent: Boolean(item.contentJson),
      hasStoragePath: Boolean(item.contentStoragePath),
    }));
    return { pageNo, pageSize: take, total, items: safeItems };
  }

  async getSkillAdmin(skillId: string) {
    const skill = await this.prisma.skillPackage.findUnique({ where: { id: skillId } });
    if (!skill) throw new NotFoundException('skill not found');
    // 解密 contentJson 给管理员查看
    let decryptedContent: unknown = null;
    if (skill.contentJson && typeof skill.contentJson === 'string') {
      try {
        decryptedContent = this.crypto.decrypt(skill.contentJson as string);
      } catch {
        decryptedContent = { _decryptError: true };
      }
    } else if (skill.contentJson) {
      decryptedContent = skill.contentJson;
    }
    return {
      ...skill,
      contentJson: decryptedContent,
    };
  }

  async createSkill(currentUser: RequestUserContext, input: CreateSkillInput) {
    if (!input.name?.trim()) throw new BadRequestException('name 不能为空');
    if (!input.version?.trim()) throw new BadRequestException('version 不能为空');

    const skillId = `skl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let encryptedContent: Prisma.InputJsonValue | undefined = undefined;
    let contentHash: string | undefined = undefined;

    if (input.contentJson) {
      encryptedContent = this.crypto.encrypt(input.contentJson) as unknown as Prisma.InputJsonValue;
      contentHash = this.crypto.hash(input.contentJson);
    }

    const metadata: Record<string, unknown> = { name: input.name.trim() };
    if (input.description) metadata.description = input.description.trim();

    const skill = await this.prisma.skillPackage.create({
      data: {
        id: skillId,
        sourceType: input.sourceType || 'custom',
        sourceUri: `custom://${skillId}`,
        version: input.version.trim(),
        reviewStatus: 'approved',
        riskLevel: input.riskLevel || 'low',
        tenantPolicyEffect: 'allow',
        metadataJson: metadata as unknown as Prisma.InputJsonValue,
        contentJson: encryptedContent,
        contentHash,
        createdBy: currentUser.id,
      },
    });

    await this.auditService.record({
      tenantId: currentUser.tenantId,
      actionType: 'skill.created',
      actionResult: 'success',
      operatorUserId: currentUser.id,
      targetType: 'skill_package',
      targetId: skillId,
      summary: `Created skill: ${input.name}`,
      riskLevel: 'medium',
      afterJson: { skillId, name: input.name, version: input.version },
    });

    return { ...stripSensitive(skill), id: skillId };
  }

  async updateSkill(currentUser: RequestUserContext, skillId: string, input: UpdateSkillInput) {
    const existing = await this.prisma.skillPackage.findUnique({ where: { id: skillId } });
    if (!existing) throw new NotFoundException('skill not found');

    const data: Record<string, unknown> = {};

    if (input.version !== undefined) data.version = input.version.trim();
    if (input.riskLevel !== undefined) data.riskLevel = input.riskLevel;
    if (input.reviewStatus !== undefined) data.reviewStatus = input.reviewStatus;
    if (input.tenantPolicyEffect !== undefined) data.tenantPolicyEffect = input.tenantPolicyEffect;

    if (input.name !== undefined || input.description !== undefined) {
      const existingMeta = (existing.metadataJson && typeof existing.metadataJson === 'object' ? existing.metadataJson : {}) as Record<string, unknown>;
      if (input.name !== undefined) existingMeta.name = input.name.trim();
      if (input.description !== undefined) existingMeta.description = input.description.trim();
      data.metadataJson = existingMeta as unknown as Prisma.InputJsonValue;
    }

    if (input.contentJson !== undefined) {
      if (input.contentJson === null) {
        data.contentJson = null;
        data.contentHash = null;
      } else {
        data.contentJson = this.crypto.encrypt(input.contentJson);
        data.contentHash = this.crypto.hash(input.contentJson);
      }
    }

    const updated = await this.prisma.skillPackage.update({ where: { id: skillId }, data });

    await this.auditService.record({
      tenantId: currentUser.tenantId,
      actionType: 'skill.updated',
      actionResult: 'success',
      operatorUserId: currentUser.id,
      targetType: 'skill_package',
      targetId: skillId,
      summary: `Updated skill: ${skillId}`,
      riskLevel: 'medium',
      afterJson: { skillId, changes: Object.keys(data) },
    });

    return stripSensitive(updated);
  }

  async deleteSkill(currentUser: RequestUserContext, skillId: string) {
    const existing = await this.prisma.skillPackage.findUnique({ where: { id: skillId } });
    if (!existing) throw new NotFoundException('skill not found');

    // 删除所有实例绑定
    await this.prisma.instanceSkillBinding.deleteMany({ where: { skillId } });
    // 删除文件存储
    await this.storage.removeSkillStorage(skillId);
    // 删除数据库记录
    await this.prisma.skillPackage.delete({ where: { id: skillId } });

    await this.auditService.record({
      tenantId: currentUser.tenantId,
      actionType: 'skill.deleted',
      actionResult: 'success',
      operatorUserId: currentUser.id,
      targetType: 'skill_package',
      targetId: skillId,
      summary: `Deleted skill: ${skillId}`,
      riskLevel: 'high',
      afterJson: { skillId },
    });

    return { deleted: true, skillId };
  }

  /** ZIP 包上传创建/更新 Skill */
  async uploadSkillPackage(currentUser: RequestUserContext, skillId: string | null, zipBuffer: Buffer) {
    const result = await this.storage.saveZipPackage(skillId, zipBuffer);

    const metadata: Record<string, unknown> = { name: result.manifest.name, description: result.manifest.description };
    if (result.manifest.type) metadata.type = result.manifest.type;
    if (result.manifest.entry) metadata.entry = result.manifest.entry;
    const metadataJsonValue = metadata as unknown as Prisma.InputJsonValue;

    const encryptedContent = this.crypto.encrypt(result.manifest) as unknown as Prisma.InputJsonValue;
    const contentHash = this.crypto.hash(result.manifest);

    if (skillId) {
      const existing = await this.prisma.skillPackage.findUnique({ where: { id: skillId } });
      if (!existing) throw new NotFoundException('skill not found');

      const updated = await this.prisma.skillPackage.update({
        where: { id: skillId },
        data: {
          version: result.manifest.version,
          metadataJson: metadataJsonValue,
          contentJson: encryptedContent,
          contentHash,
          contentStoragePath: result.storagePath,
          packageSize: result.packageSize,
        },
      });

      await this.auditService.record({
        tenantId: currentUser.tenantId,
        actionType: 'skill.uploaded',
        actionResult: 'success',
        operatorUserId: currentUser.id,
        targetType: 'skill_package',
        targetId: skillId,
        summary: `Uploaded skill package: ${result.manifest.name}`,
        riskLevel: 'medium',
        afterJson: { skillId, name: result.manifest.name, version: result.manifest.version, packageSize: result.packageSize },
      });

      return stripSensitive(updated);
    }

    const newSkillId = `skl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const created = await this.prisma.skillPackage.create({
      data: {
        id: newSkillId,
        sourceType: 'package',
        sourceUri: `package://${newSkillId}`,
        version: result.manifest.version,
        reviewStatus: 'approved',
        riskLevel: 'low',
        tenantPolicyEffect: 'allow',
        metadataJson: metadataJsonValue,
        contentJson: encryptedContent,
        contentHash,
        contentStoragePath: result.storagePath,
        packageSize: result.packageSize,
        createdBy: currentUser.id,
      },
    });

    await this.auditService.record({
      tenantId: currentUser.tenantId,
      actionType: 'skill.uploaded',
      actionResult: 'success',
      operatorUserId: currentUser.id,
      targetType: 'skill_package',
      targetId: newSkillId,
      summary: `Created skill from package: ${result.manifest.name}`,
      riskLevel: 'medium',
      afterJson: { skillId: newSkillId, name: result.manifest.name, version: result.manifest.version, packageSize: result.packageSize },
    });

    return stripSensitive(created);
  }

  // ──────────────────────────── 运行时注入（服务端内部使用） ────────────────────────────

  /** 获取指定实例已启用的 Skill 的完整内容（用于运行时配置注入） */
  async getEnabledSkillContents(instanceId: string): Promise<Array<{ id: string; content: unknown; storagePath: string | null; metadata?: unknown }>> {
    const bindings = await this.prisma.instanceSkillBinding.findMany({
      where: { instanceId, enabled: true },
    });
    if (bindings.length === 0) return [];

    const skillIds = bindings.map((b) => b.skillId);
    const skills = await this.prisma.skillPackage.findMany({
      where: { id: { in: skillIds }, reviewStatus: 'approved' },
    });

    return skills.map((skill) => {
      let content: unknown = null;
      if (skill.contentJson && typeof skill.contentJson === 'string') {
        try {
          content = this.crypto.decrypt(skill.contentJson as string);
        } catch {
          content = null;
        }
      } else if (skill.contentJson) {
        content = skill.contentJson;
      }
      return {
        id: skill.id,
        content,
        storagePath: skill.contentStoragePath,
        metadata: skill.metadataJson,
      };
    });
  }
}
