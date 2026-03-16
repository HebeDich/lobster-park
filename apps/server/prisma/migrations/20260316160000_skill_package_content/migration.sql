-- AlterTable
ALTER TABLE "SkillPackage" ADD COLUMN "contentJson" JSONB;
ALTER TABLE "SkillPackage" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "SkillPackage" ADD COLUMN "contentStoragePath" TEXT;
ALTER TABLE "SkillPackage" ADD COLUMN "packageSize" INTEGER;
ALTER TABLE "SkillPackage" ADD COLUMN "createdBy" TEXT;
