import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans(onlyActive = false) {
    const where = onlyActive ? { isActive: true } : {};
    return this.prisma.plan.findMany({ where, orderBy: { displayOrder: 'asc' } });
  }

  async getPlan(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('套餐不存在');
    return plan;
  }

  async createPlan(body: Record<string, unknown>) {
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('套餐名称不能为空');
    const priceCents = Number(body.priceCents ?? 0);
    if (!Number.isFinite(priceCents) || priceCents < 0) throw new BadRequestException('价格无效');

    return this.prisma.plan.create({
      data: {
        id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        description: body.description ? String(body.description) : null,
        priceCents,
        maxInstances: Number(body.maxInstances ?? 1),
        allowedSpecs: String(body.allowedSpecs ?? 'S'),
        validityDays: body.validityDays ? Number(body.validityDays) : null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        displayOrder: Number(body.displayOrder ?? 0),
      },
    });
  }

  async updatePlan(planId: string, body: Record<string, unknown>) {
    const existing = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!existing) throw new NotFoundException('套餐不存在');

    return this.prisma.plan.update({
      where: { id: planId },
      data: {
        ...(body.name !== undefined ? { name: String(body.name) } : {}),
        ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
        ...(body.priceCents !== undefined ? { priceCents: Number(body.priceCents) } : {}),
        ...(body.maxInstances !== undefined ? { maxInstances: Number(body.maxInstances) } : {}),
        ...(body.allowedSpecs !== undefined ? { allowedSpecs: String(body.allowedSpecs) } : {}),
        ...(body.validityDays !== undefined ? { validityDays: body.validityDays ? Number(body.validityDays) : null } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.displayOrder !== undefined ? { displayOrder: Number(body.displayOrder) } : {}),
      },
    });
  }

  async deletePlan(planId: string) {
    const existing = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!existing) throw new NotFoundException('套餐不存在');
    await this.prisma.plan.delete({ where: { id: planId } });
    return null;
  }
}
