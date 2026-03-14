-- CreateTable
CREATE TABLE "InstanceSkillBinding" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceSkillBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstanceSkillBinding_instanceId_skillId_key" ON "InstanceSkillBinding"("instanceId", "skillId");

-- AddForeignKey
ALTER TABLE "InstanceSkillBinding" ADD CONSTRAINT "InstanceSkillBinding_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
