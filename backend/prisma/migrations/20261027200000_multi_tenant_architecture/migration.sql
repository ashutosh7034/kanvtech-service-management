-- Multi-Tenant Transformation Migration
-- Isolated migration for KANVTECH platform multi-tenancy

-- 1. Create TenantStatus Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantStatus') THEN
        CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
    END IF;
END$$;

-- 2. Add SUPER_ADMIN to UserRole Enum if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'UserRole' AND e.enumlabel = 'SUPER_ADMIN'
    ) THEN
        ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
    END IF;
END$$;

-- 3. Create tenants Table
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "domain" VARCHAR(191),
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_code_key" ON "tenants"("code");

-- 4. Create tenant_memberships Table
CREATE TABLE IF NOT EXISTS "tenant_memberships" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tenant_id" VARCHAR(50) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'L1_EMPLOYEE',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_tenant" ON "tenant_memberships"("user_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_memberships_user" ON "tenant_memberships"("user_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_memberships_tenant" ON "tenant_memberships"("tenant_id");

-- Add foreign keys for tenant_memberships
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_memberships_user_id_fkey') THEN
        ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_memberships_tenant_id_fkey') THEN
        ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- 5. Add is_super_admin and default_tenant_id to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "default_tenant_id" VARCHAR(50);

-- 6. Insert Default KANVTECH Tenant
INSERT INTO "tenants" ("id", "name", "code", "status", "is_default", "created_at", "updated_at")
VALUES ('KANVTECH', 'Kanvtech Technologies', 'kanvtech', 'ACTIVE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "is_default" = true, "status" = 'ACTIVE';

-- 7. Add tenant_id column to all tenant-scoped tables
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "implementations" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "sla_configurations" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "employee_tasks" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH';
CREATE TABLE IF NOT EXISTS "inbound_email_logs" (
    "id" SERIAL NOT NULL,
    "message_id" VARCHAR(255) NOT NULL,
    "sender_email" VARCHAR(191) NOT NULL,
    "sender_name" VARCHAR(150),
    "recipient_email" VARCHAR(191) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body_text" TEXT,
    "body_html" TEXT,
    "in_reply_to" VARCHAR(255),
    "references" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PROCESSED',
    "matched_company_id" VARCHAR(50),
    "matched_contact_id" INTEGER,
    "ticket_id" VARCHAR(50),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "raw_payload_json" TEXT,
    "attachments_json" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" VARCHAR(50) NOT NULL DEFAULT 'KANVTECH',

    CONSTRAINT "inbound_email_logs_pkey" PRIMARY KEY ("id")
);

-- Add Indexes for tenant_id on key tables
CREATE INDEX IF NOT EXISTS "idx_companies_tenant" ON "companies"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_departments_tenant" ON "departments"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_employees_tenant" ON "employees"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_tenant" ON "tickets"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_products_tenant" ON "products"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_tenant" ON "subscriptions"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_implementations_tenant" ON "implementations"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_tenant" ON "audit_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_tenant" ON "notifications"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_employee_tasks_tenant" ON "employee_tasks"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_chat_conversations_tenant" ON "chat_conversations"("tenant_id");

-- 8. Add Foreign Keys to tenants table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_tenant_id_fkey') THEN
        ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_tenant_id_fkey') THEN
        ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_tenant_id_fkey') THEN
        ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_tenant_id_fkey') THEN
        ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_tenant_id_fkey') THEN
        ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tenant_id_fkey') THEN
        ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'implementations_tenant_id_fkey') THEN
        ALTER TABLE "implementations" ADD CONSTRAINT "implementations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- 9. Map Existing Users into KANVTECH Tenant Membership
INSERT INTO "tenant_memberships" ("user_id", "tenant_id", "role", "is_default", "is_active", "created_at", "updated_at")
SELECT u."id", 'KANVTECH', u."role", true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
ON CONFLICT ("user_id", "tenant_id") DO NOTHING;

-- 10. Designate Platform Super Admin
UPDATE "users"
SET "is_super_admin" = true, "default_tenant_id" = 'KANVTECH'
WHERE "email" = 'admin@kanvtech.com';

-- 11. Replace Global Unique Constraints with Multi-Tenant Composite Unique Constraints
ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_name_key";
ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_dept_tenant_name" ON "departments"("tenant_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_dept_tenant_code" ON "departments"("tenant_id", "code");

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_product_tenant_code" ON "products"("tenant_id", "code");

ALTER TABLE "sla_configurations" DROP CONSTRAINT IF EXISTS "sla_configurations_priority_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_sla_tenant_priority" ON "sla_configurations"("tenant_id", "priority");

