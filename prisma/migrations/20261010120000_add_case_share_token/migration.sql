ALTER TABLE "Case" ADD COLUMN "shareToken" TEXT;

CREATE UNIQUE INDEX "Case_shareToken_key" ON "Case"("shareToken");

ALTER TABLE "Case" ALTER COLUMN "isPublic" SET DEFAULT false;
