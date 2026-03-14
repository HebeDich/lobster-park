DROP INDEX IF EXISTS "Instance_tenantId_name_key";

CREATE UNIQUE INDEX "Instance_tenantId_name_active_key"
ON "Instance"("tenantId", "name")
WHERE "deletedAt" IS NULL;
