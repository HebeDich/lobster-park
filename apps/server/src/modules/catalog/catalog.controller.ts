import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { SkillsService } from '../skills/skills.service';

@Controller()
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly accessControl: AccessControlService,
    private readonly skillsService: SkillsService,
  ) {}

  @Get('catalog/skills')
  async listSkills(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20') {
    this.authService.requirePermission(currentUser, 'skill.view');
    const take = Number(pageSize);
    const skip = (Number(pageNo) - 1) * take;
    const [total, items] = await Promise.all([
      this.prisma.skillPackage.count(),
      this.prisma.skillPackage.findMany({ orderBy: { createdAt: 'asc' }, skip, take }),
    ]);
    return { pageNo: Number(pageNo), pageSize: take, total, items };
  }

  @Get('instances/:instanceId/skills')
  async listInstanceSkills(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '50') {
    this.authService.requirePermission(currentUser, 'skill.view');
    return this.skillsService.listInstanceSkills(currentUser, instanceId, Number(pageNo), Number(pageSize));
  }

  @Post('instances/:instanceId/skills/:skillId/enable')
  async enableSkill(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('skillId') skillId: string) {
    this.authService.requirePermission(currentUser, 'skill.enable');
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    return this.skillsService.setInstanceSkillEnabled(currentUser, instanceId, skillId, true);
  }

  @Post('instances/:instanceId/skills/:skillId/disable')
  async disableSkill(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('skillId') skillId: string) {
    this.authService.requirePermission(currentUser, 'skill.disable');
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    return this.skillsService.setInstanceSkillEnabled(currentUser, instanceId, skillId, false);
  }

  @Get('catalog/templates')
  async listTemplates(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20') {
    this.authService.requirePermission(currentUser, 'template.use');
    const take = Number(pageSize);
    const skip = (Number(pageNo) - 1) * take;
    const [total, items] = await Promise.all([
      this.prisma.templateRecord.count({ where: { status: 'active' } }),
      this.prisma.templateRecord.findMany({ where: { status: 'active' }, orderBy: { createdAt: 'asc' }, skip, take }),
    ]);
    return { pageNo: Number(pageNo), pageSize: take, total, items };
  }

  @Post('platform/templates')
  async createPlatformTemplate(@CurrentUser() currentUser: RequestUserContext, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'template.manage');
    return this.prisma.templateRecord.create({
      data: {
        id: `tpl_${Date.now()}`,
        tenantScope: String(body.tenantScope ?? 'platform'),
        name: String(body.name ?? 'New Template'),
        templateType: String(body.templateType ?? 'custom'),
        specCode: String(body.specCode ?? 'S'),
        status: String(body.status ?? 'active'),
        configJson: (body.configJson as Prisma.InputJsonValue | undefined) ?? {},
        createdBy: currentUser.id,
      },
    });
  }
}
