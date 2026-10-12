CREATE TABLE "AiAbuseBucket" (
    "key" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "activeCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAbuseBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "AiAbuseBucket_updatedAt_idx" ON "AiAbuseBucket"("updatedAt");
