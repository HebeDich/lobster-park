-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "quotaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "roleCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "specCode" TEXT NOT NULL,
    "runtimeVersion" TEXT NOT NULL,
    "lifecycleStatus" TEXT NOT NULL,
    "healthStatus" TEXT,
    "currentActiveVersionId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeBinding" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "isolationMode" TEXT NOT NULL,
    "runtimeVersion" TEXT NOT NULL,
    "hostNode" TEXT,
    "processId" TEXT,
    "portBindingsJson" JSONB NOT NULL,
    "configPath" TEXT NOT NULL,
    "workspacePath" TEXT NOT NULL,
    "statePath" TEXT NOT NULL,
    "logPath" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceSecret" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "cipherValue" TEXT NOT NULL,
    "maskedPreview" TEXT NOT NULL,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigDraft" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "draftJson" JSONB NOT NULL,
    "dirtyFlag" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigVersion" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "versionStatus" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'publish',
    "normalizedConfigJson" JSONB NOT NULL,
    "validationErrorsJson" JSONB,
    "publishNote" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "ConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "instanceId" TEXT,
    "jobType" TEXT NOT NULL,
    "jobStatus" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorCode" INTEGER,
    "errorMessage" TEXT,
    "requestId" TEXT NOT NULL,
    "payloadJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceId" TEXT,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventKey" TEXT,
    "ackedBy" TEXT,
    "ackedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertId" TEXT,
    "eventType" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipient" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" JSONB,
    "sendStatus" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "boundInstanceId" TEXT,
    "pairingStatus" TEXT NOT NULL,
    "onlineStatus" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "capabilitiesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingRequestRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "nodeFingerprint" TEXT NOT NULL,
    "pairingStatus" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PairingRequestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionResult" TEXT NOT NULL,
    "operatorUserId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "summary" TEXT,
    "traceId" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPackage" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUri" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "tenantPolicyEffect" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateRecord" (
    "id" TEXT NOT NULL,
    "tenantScope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "specCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "settingValueJson" JSONB,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "operatorUserId" TEXT NOT NULL,
    "responseJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_tenantId_name_key" ON "Instance"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeBinding_instanceId_key" ON "RuntimeBinding"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceSecret_instanceId_secretKey_key" ON "InstanceSecret"("instanceId", "secretKey");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigDraft_instanceId_key" ON "ConfigDraft"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_instanceId_versionNo_key" ON "ConfigVersion"("instanceId", "versionNo");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSetting_settingKey_key" ON "PlatformSetting"("settingKey");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_idempotencyKey_scope_operatorUserId_key" ON "IdempotencyRecord"("idempotencyKey", "scope", "operatorUserId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeBinding" ADD CONSTRAINT "RuntimeBinding_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceSecret" ADD CONSTRAINT "InstanceSecret_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigDraft" ADD CONSTRAINT "ConfigDraft_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigVersion" ADD CONSTRAINT "ConfigVersion_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRecord" ADD CONSTRAINT "AlertRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRecord" ADD CONSTRAINT "AlertRecord_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecord" ADD CONSTRAINT "NotificationRecord_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRecord" ADD CONSTRAINT "NodeRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRecord" ADD CONSTRAINT "NodeRecord_boundInstanceId_fkey" FOREIGN KEY ("boundInstanceId") REFERENCES "Instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingRequestRecord" ADD CONSTRAINT "PairingRequestRecord_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

