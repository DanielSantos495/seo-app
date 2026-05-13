-- CreateTable
CREATE TABLE "SeoJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processed" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "payload" TEXT,
    "resultSummary" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "lastHeartbeatAt" DATETIME
);

-- CreateIndex
CREATE INDEX "SeoJob_shop_status_idx" ON "SeoJob"("shop", "status");

-- CreateIndex
CREATE INDEX "SeoJob_shop_type_status_idx" ON "SeoJob"("shop", "type", "status");
