-- Add idempotencyKey column to sales table
-- This column is used to prevent duplicate sales during checkout

ALTER TABLE "sales" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "sales_idempotencyKey_key" ON "sales"("idempotencyKey");
