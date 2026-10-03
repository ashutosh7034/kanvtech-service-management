/*
  Warnings:

  - You are about to drop the column `product_id` on the `departments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_product_id_fkey";

-- DropIndex
DROP INDEX "departments_product_id_key";

-- AlterTable
ALTER TABLE "company_branches" ADD COLUMN     "alternate_contacts" TEXT,
ADD COLUMN     "alternate_emails" TEXT,
ADD COLUMN     "alternate_phones" TEXT;

-- AlterTable
ALTER TABLE "company_products" ADD COLUMN     "purchase_type" VARCHAR(50) NOT NULL DEFAULT 'COMPLETE';

-- AlterTable
ALTER TABLE "departments" DROP COLUMN "product_id";

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "alternate_emails" TEXT,
ADD COLUMN     "alternate_phones" TEXT;

-- AlterTable
ALTER TABLE "implementation_tasks" ADD COLUMN     "module_id" VARCHAR(50);

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "module_id" VARCHAR(50),
ADD COLUMN     "submodule_id" VARCHAR(50);

-- CreateTable
CREATE TABLE "company_product_modules" (
    "id" SERIAL NOT NULL,
    "company_product_id" INTEGER NOT NULL,
    "module_id" VARCHAR(50) NOT NULL,

    CONSTRAINT "company_product_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_product_modules" (
    "id" SERIAL NOT NULL,
    "branch_product_id" INTEGER NOT NULL,
    "module_id" VARCHAR(50) NOT NULL,

    CONSTRAINT "branch_product_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_products" (
    "id" SERIAL NOT NULL,
    "department_id" VARCHAR(50) NOT NULL,
    "product_id" VARCHAR(50) NOT NULL,

    CONSTRAINT "department_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_levels" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "order_index" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "support_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_modules" (
    "id" VARCHAR(50) NOT NULL,
    "product_id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_submodules" (
    "id" VARCHAR(50) NOT NULL,
    "module_id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_submodules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" VARCHAR(50) NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "contact_person" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "address" TEXT,
    "enquiry" TEXT,
    "source" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'ENQUIRY',
    "converted_to_company_id" VARCHAR(50),
    "assigned_employee_id" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_tasks" (
    "id" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3),
    "due_time" VARCHAR(20),
    "priority" VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    "reminder_time" TIMESTAMP(3),
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "created_by" VARCHAR(50) NOT NULL,
    "assigned_to" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "employee_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255),
    "is_group" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_participants" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_read_receipts" (
    "id" SERIAL NOT NULL,
    "message_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credentials" (
    "id" SERIAL NOT NULL,
    "company_id" VARCHAR(50) NOT NULL,
    "product_id" VARCHAR(50),
    "url" VARCHAR(255),
    "username" VARCHAR(150) NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_product_modules_company_product_id_module_id_key" ON "company_product_modules"("company_product_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_product_modules_branch_product_id_module_id_key" ON "branch_product_modules"("branch_product_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_products_department_id_product_id_key" ON "department_products"("department_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_levels_name_key" ON "support_levels"("name");

-- CreateIndex
CREATE INDEX "idx_emp_tasks_assignee" ON "employee_tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "idx_chat_part_conv" ON "chat_participants"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_chat_part_user" ON "chat_participants"("user_id");

-- CreateIndex
CREATE INDEX "idx_chat_msg_conv" ON "chat_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_chat_read_msg" ON "chat_read_receipts"("message_id");

-- CreateIndex
CREATE INDEX "idx_cust_cred_company" ON "customer_credentials"("company_id");

-- AddForeignKey
ALTER TABLE "company_product_modules" ADD CONSTRAINT "company_product_modules_company_product_id_fkey" FOREIGN KEY ("company_product_id") REFERENCES "company_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_product_modules" ADD CONSTRAINT "company_product_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "product_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_product_modules" ADD CONSTRAINT "branch_product_modules_branch_product_id_fkey" FOREIGN KEY ("branch_product_id") REFERENCES "branch_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_product_modules" ADD CONSTRAINT "branch_product_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "product_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_products" ADD CONSTRAINT "department_products_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_products" ADD CONSTRAINT "department_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "product_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_submodule_id_fkey" FOREIGN KEY ("submodule_id") REFERENCES "product_submodules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modules" ADD CONSTRAINT "product_modules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_submodules" ADD CONSTRAINT "product_submodules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "product_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_tasks" ADD CONSTRAINT "employee_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_tasks" ADD CONSTRAINT "employee_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_read_receipts" ADD CONSTRAINT "chat_read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_read_receipts" ADD CONSTRAINT "chat_read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credentials" ADD CONSTRAINT "customer_credentials_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
