-- AlterTable
ALTER TABLE "company_product_modules" ADD COLUMN "submodule_ids" TEXT;

-- AlterTable
ALTER TABLE "branch_product_modules" ADD COLUMN "submodule_ids" TEXT;

-- AlterTable
ALTER TABLE "company_products" ALTER COLUMN "purchase_type" SET DEFAULT 'SELECTED_MODULES';
