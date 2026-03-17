import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { PlanService } from './plan.service';

@Controller('plans')
export class PlanController {
  constructor(
    private readonly planService: PlanService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  listPlans(@CurrentUser() currentUser: RequestUserContext, @Query('onlyActive') onlyActive?: string) {
    return this.planService.listPlans(onlyActive === 'true');
  }

  @Get(':planId')
  getPlan(@CurrentUser() currentUser: RequestUserContext, @Param('planId') planId: string) {
    return this.planService.getPlan(planId);
  }

  @Post()
  @HttpCode(201)
  createPlan(@CurrentUser() currentUser: RequestUserContext, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'platform.settings.manage');
    return this.planService.createPlan(body);
  }

  @Patch(':planId')
  updatePlan(@CurrentUser() currentUser: RequestUserContext, @Param('planId') planId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'platform.settings.manage');
    return this.planService.updatePlan(planId, body);
  }

  @Delete(':planId')
  deletePlan(@CurrentUser() currentUser: RequestUserContext, @Param('planId') planId: string) {
    this.authService.requirePermission(currentUser, 'platform.settings.manage');
    return this.planService.deletePlan(planId);
  }
}
