-- Migration: 20261114160000_custom_user_id_management
-- Custom Login User ID & Lifecycle Management

-- 1. Add custom_user_id to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "custom_user_id" VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS "users_custom_user_id_key" ON "users"("custom_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_custom_user_id_lower_idx" ON "users"(LOWER("custom_user_id"));

-- 2. Add custom_user_id to employees
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "custom_user_id" VARCHAR(50);
CREATE INDEX IF NOT EXISTS "idx_employees_custom_user_id" ON "employees"("custom_user_id");

-- 3. Create user_id_change_history table
CREATE TABLE IF NOT EXISTS "user_id_change_history" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "previous_user_id" VARCHAR(50),
    "new_user_id" VARCHAR(50) NOT NULL,
    "changed_by_user_id" INTEGER NOT NULL,
    "changed_by_name" VARCHAR(150),
    "tenant_id" VARCHAR(50) NOT NULL,
    "change_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_id_change_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_user_id_history_user" ON "user_id_change_history"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_id_history_tenant" ON "user_id_change_history"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_user_id_history_new_id" ON "user_id_change_history"("new_user_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_id_change_history_user_id_fkey') THEN
        ALTER TABLE "user_id_change_history" ADD CONSTRAINT "user_id_change_history_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- 4. Create reserved_user_ids table
CREATE TABLE IF NOT EXISTS "reserved_user_ids" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "tenant_id" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserved_user_ids_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reserved_user_ids_user_id_key" ON "reserved_user_ids"("user_id");
CREATE INDEX IF NOT EXISTS "idx_reserved_user_id" ON "reserved_user_ids"("user_id");

-- 5. Seed System Reserved Identifiers
INSERT INTO "reserved_user_ids" ("user_id", "reason", "created_at")
VALUES
    ('admin', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('administrator', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('system', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('root', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('superuser', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('kanvtech', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('support', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('helpdesk', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('api', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('null', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('undefined', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('anonymous', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('guest', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('security', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('billing', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP),
    ('contact', 'SYSTEM_RESERVED', CURRENT_TIMESTAMP)
ON CONFLICT ("user_id") DO NOTHING;
