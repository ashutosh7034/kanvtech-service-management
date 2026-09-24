-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'RENEWED');

-- CreateEnum
CREATE TYPE "ImplementationStatus" AS ENUM ('NEW', 'PLANNING', 'IN_PROGRESS', 'CONFIGURATION', 'TESTING', 'READY_FOR_GO_LIVE', 'LIVE', 'COMPLETED', 'BLOCKED');

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'REOPENED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "products" (
    "id" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" VARCHAR(50) NOT NULL,
    "company_id" VARCHAR(50) NOT NULL,
    "product_id" VARCHAR(50) NOT NULL,
    "plan_name" VARCHAR(100) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "renewal_date" TIMESTAMP(3),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "owner_employee_id" VARCHAR(50),
    "notes" TEXT,
    "last_warning_sent_at" TIMESTAMP(3),
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "implementations" (
    "id" VARCHAR(50) NOT NULL,
    "company_id" VARCHAR(50) NOT NULL,
    "product_id" VARCHAR(50) NOT NULL,
    "subscription_id" VARCHAR(50),
    "owner_employee_id" VARCHAR(50),
    "team_members_json" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "target_go_live_date" TIMESTAMP(3) NOT NULL,
    "actual_go_live_date" TIMESTAMP(3),
    "status" "ImplementationStatus" NOT NULL DEFAULT 'NEW',
    "progress_percentage" INTEGER NOT NULL DEFAULT 0,
    "pending_activities" TEXT,
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "implementations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket_reopen_history" (
    "id" SERIAL NOT NULL,
    "ticket_id" VARCHAR(50) NOT NULL,
    "reopened_by" INTEGER NOT NULL,
    "reopen_reason" TEXT NOT NULL,
    "previous_status" "TicketStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_reopen_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_products_code" ON "products"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_products_category" ON "products"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_products_active" ON "products"("is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_subscriptions_company" ON "subscriptions"("company_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_subscriptions_product" ON "subscriptions"("product_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_subscriptions_status" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_subscriptions_expiry" ON "subscriptions"("expiry_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_implementations_company" ON "implementations"("company_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_implementations_product" ON "implementations"("product_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_implementations_status" ON "implementations"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_reopen_ticket" ON "ticket_reopen_history"("ticket_id");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_company_id_fkey') THEN
        ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_product_id_fkey') THEN
        ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_owner_employee_id_fkey') THEN
        ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'implementations_company_id_fkey') THEN
        ALTER TABLE "implementations" ADD CONSTRAINT "implementations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'implementations_product_id_fkey') THEN
        ALTER TABLE "implementations" ADD CONSTRAINT "implementations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'implementations_subscription_id_fkey') THEN
        ALTER TABLE "implementations" ADD CONSTRAINT "implementations_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'implementations_owner_employee_id_fkey') THEN
        ALTER TABLE "implementations" ADD CONSTRAINT "implementations_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_reopen_history_ticket_id_fkey') THEN
        ALTER TABLE "ticket_reopen_history" ADD CONSTRAINT "ticket_reopen_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_reopen_history_reopened_by_fkey') THEN
        ALTER TABLE "ticket_reopen_history" ADD CONSTRAINT "ticket_reopen_history_reopened_by_fkey" FOREIGN KEY ("reopened_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
