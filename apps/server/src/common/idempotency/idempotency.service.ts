import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(input: {
    idempotencyKey: string;
    scope: string;
    operatorUserId: string;
    run: () => Promise<T>;
  }): Promise<T> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        idempotencyKey_scope_operatorUserId: {
          idempotencyKey: input.idempotencyKey,
          scope: input.scope,
          operatorUserId: input.operatorUserId,
        },
      },
    });

    if (existing?.responseJson !== undefined && existing.responseJson !== null) {
      return existing.responseJson as T;
    }

    const response = await input.run();

    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          id: `idm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          idempotencyKey: input.idempotencyKey,
          scope: input.scope,
          operatorUserId: input.operatorUserId,
          responseJson: response as Prisma.InputJsonValue,
        },
      });
      return response;
    } catch (error) {
      const duplicate = await this.prisma.idempotencyRecord.findUniqueOrThrow({
        where: {
          idempotencyKey_scope_operatorUserId: {
            idempotencyKey: input.idempotencyKey,
            scope: input.scope,
            operatorUserId: input.operatorUserId,
          },
        },
      });
      return duplicate.responseJson as T;
    }
  }
}
