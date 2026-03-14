import { Injectable, NotFoundException } from '@nestjs/common';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly auditService: AuditService,
  ) {}

  async listInstanceSkills(currentUser: RequestUserContext, instanceId: string, pageNo = 1, pageSize = 50) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [packages, bindings] = await Promise.all([
      this.prisma.skillPackage.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.instanceSkillBinding.findMany({ where: { instanceId } }),
    ]);
    const enabledMap = new Map(bindings.map((binding) => [binding.skillId, binding.enabled]));
    const items = packages.map((item) => ({ ...item, enabled: enabledMap.get(item.id) ?? false }));
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
}
