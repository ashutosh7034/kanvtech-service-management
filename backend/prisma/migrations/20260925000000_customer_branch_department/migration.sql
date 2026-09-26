-- AlterEnum
ALTER TYPE "EmployeeLevel" ADD VALUE IF NOT EXISTS 'MANAGER';

-- CreateTable: company_products
CREATE TABLE IF NOT EXISTS "company_products" (
    "id" SERIAL NOT NULL,
    "company_id" VARCHAR(50) NOT NULL,
    "product_id" VARCHAR(50) NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable: company_branches
CREATE TABLE IF NOT EXISTS "company_branches" (
    "id" VARCHAR(50) NOT NULL,
    "company_id" VARCHAR(50) NOT NULL,
    "branch_name" VARCHAR(150) NOT NULL,
    "address" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(20),
    "contact_person" VARCHAR(150) NOT NULL,
    "contact_phone" VARCHAR(50) NOT NULL,
    "contact_email" VARCHAR(191),
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable: branch_products
CREATE TABLE IF NOT EXISTS "branch_products" (
    "id" SERIAL NOT NULL,
    "branch_id" VARCHAR(50) NOT NULL,
    "product_id" VARCHAR(50) NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable: departments
CREATE TABLE IF NOT EXISTS "departments" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "product_id" VARCHAR(50),
    "manager_id" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- AlterTable: employees
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(50);

-- AlterTable: tickets
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "product_id" VARCHAR(50);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "branch_id" VARCHAR(50);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_products_company_id_product_id_key" ON "company_products"("company_id", "product_id");
CREATE INDEX IF NOT EXISTS "idx_company_products_company" ON "company_products"("company_id");
CREATE INDEX IF NOT EXISTS "idx_company_products_product" ON "company_products"("product_id");

CREATE INDEX IF NOT EXISTS "idx_branches_company" ON "company_branches"("company_id");
CREATE INDEX IF NOT EXISTS "idx_branches_status" ON "company_branches"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "branch_products_branch_id_product_id_key" ON "branch_products"("branch_id", "product_id");
CREATE INDEX IF NOT EXISTS "idx_branch_products_branch" ON "branch_products"("branch_id");
CREATE INDEX IF NOT EXISTS "idx_branch_products_product" ON "branch_products"("product_id");

CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_key" ON "departments"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "departments_code_key" ON "departments"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "departments_product_id_key" ON "departments"("product_id");
CREATE INDEX IF NOT EXISTS "idx_departments_code" ON "departments"("code");
CREATE INDEX IF NOT EXISTS "idx_departments_active" ON "departments"("is_active");

CREATE INDEX IF NOT EXISTS "idx_employees_department_id" ON "employees"("department_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_product" ON "tickets"("product_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_branch" ON "tickets"("branch_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_department" ON "tickets"("department_id");

-- Foreign Keys
DO $$ BEGIN
    -- company_products -> companies
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_products_company_id_fkey') THEN
        ALTER TABLE "company_products" ADD CONSTRAINT "company_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    -- company_products -> products
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_products_product_id_fkey') THEN
        ALTER TABLE "company_products" ADD CONSTRAINT "company_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- company_branches -> companies
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_branches_company_id_fkey') THEN
        ALTER TABLE "company_branches" ADD CONSTRAINT "company_branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- branch_products -> company_branches
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'branch_products_branch_id_fkey') THEN
        ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "company_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    -- branch_products -> products
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'branch_products_product_id_fkey') THEN
        ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- departments -> products
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_product_id_fkey') THEN
        ALTER TABLE "departments" ADD CONSTRAINT "departments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    -- departments -> employees (manager)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_manager_id_fkey') THEN
        ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- employees -> departments
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_department_id_fkey') THEN
        ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- tickets -> products
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_product_id_fkey') THEN
        ALTER TABLE "tickets" ADD CONSTRAINT "tickets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    -- tickets -> company_branches
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_branch_id_fkey') THEN
        ALTER TABLE "tickets" ADD CONSTRAINT "tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "company_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    -- tickets -> departments
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_department_id_fkey') THEN
        ALTER TABLE "tickets" ADD CONSTRAINT "tickets_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
