-- CreateTable
CREATE TABLE "AuditOutboxRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "auditLogId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditOutboxRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditOutboxRecord_auditLogId_key" ON "AuditOutboxRecord"("auditLogId");
