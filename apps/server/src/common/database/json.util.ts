import { Prisma } from '@prisma/client';
import type { AnyJsonValue } from '@lobster-park/shared';

export function toPrismaJson(value: AnyJsonValue | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
