import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { SkillsService } from './skills.service';
import type { CreateSkillInput, UpdateSkillInput } from './skills.service';

/**
 * 平台管理员 Skill 管理接口
 * 路由前缀: platform/skills
 */
@Controller()
export class SkillsController {
  constructor(
    private readonly authService: AuthService,
    private readonly skillsService: SkillsService,
  ) {}

  /** 管理员列表 — 返回所有 Skill（contentJson 标记为加密） */
  @Get('platform/skills')
  async listSkills(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20') {
    this.authService.requirePermission(currentUser, 'skill.manage');
    return this.skillsService.listSkillsAdmin(Number(pageNo), Number(pageSize));
  }

  /** 管理员详情 — 返回解密后的 Skill 内容 */
  @Get('platform/skills/:skillId')
  async getSkill(@CurrentUser() currentUser: RequestUserContext, @Param('skillId') skillId: string) {
    this.authService.requirePermission(currentUser, 'skill.manage');
    return this.skillsService.getSkillAdmin(skillId);
  }

  /** 表单创建 Skill（简单 Skill：prompt/工具型） */
  @Post('platform/skills')
  async createSkill(@CurrentUser() currentUser: RequestUserContext, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'skill.manage');
    const input: CreateSkillInput = {
      name: String(body.name ?? ''),
      description: body.description ? String(body.description) : undefined,
      version: String(body.version ?? '1.0.0'),
      sourceType: String(body.sourceType ?? 'custom'),
      riskLevel: body.riskLevel ? String(body.riskLevel) : undefined,
      contentJson: body.contentJson ?? undefined,
    };
    return this.skillsService.createSkill(currentUser, input);
  }

  /** 更新 Skill */
  @Put('platform/skills/:skillId')
  async updateSkill(@CurrentUser() currentUser: RequestUserContext, @Param('skillId') skillId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'skill.manage');
    const input: UpdateSkillInput = {};
    if (body.name !== undefined) input.name = String(body.name);
    if (body.description !== undefined) input.description = String(body.description);
    if (body.version !== undefined) input.version = String(body.version);
    if (body.riskLevel !== undefined) input.riskLevel = String(body.riskLevel);
    if (body.reviewStatus !== undefined) input.reviewStatus = String(body.reviewStatus);
    if (body.tenantPolicyEffect !== undefined) input.tenantPolicyEffect = String(body.tenantPolicyEffect);
    if (body.contentJson !== undefined) input.contentJson = body.contentJson;
    return this.skillsService.updateSkill(currentUser, skillId, input);
  }

  /** 删除 Skill */
  @Delete('platform/skills/:skillId')
  async deleteSkill(@CurrentUser() currentUser: RequestUserContext, @Param('skillId') skillId: string) {
    this.authService.requirePermission(currentUser, 'skill.manage');
    return this.skillsService.deleteSkill(currentUser, skillId);
  }

  /** ZIP 包上传创建/更新 Skill */
  @Post('platform/skills/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadSkillPackage(
    @CurrentUser() currentUser: RequestUserContext,
    @UploadedFile() file: { buffer: Buffer; originalname: string; size: number; mimetype: string },
    @Body() body: Record<string, unknown>,
  ) {
    this.authService.requirePermission(currentUser, 'skill.manage');
    if (!file || !file.buffer) {
      throw new Error('请上传 ZIP 文件');
    }
    const skillId = body.skillId ? String(body.skillId) : null;
    return this.skillsService.uploadSkillPackage(currentUser, skillId, file.buffer);
  }
}
