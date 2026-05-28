-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "aiAlt" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_shop_idx" ON "AiUsage"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_shop_period_key" ON "AiUsage"("shop", "period");
