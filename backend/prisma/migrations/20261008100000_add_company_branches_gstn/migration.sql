-- AlterTable: company_branches
ALTER TABLE "company_branches" ADD COLUMN IF NOT EXISTS "gstn" VARCHAR(50);
