-- CreateTable
CREATE TABLE "SessionRecord" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OidcStateRecord" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OidcStateRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionRecord_tokenHash_key" ON "SessionRecord"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "OidcStateRecord_state_key" ON "OidcStateRecord"("state");
