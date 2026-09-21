-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "EmployeeLevel" AS ENUM ('L1', 'L2', 'L3');

-- CreateEnum
CREATE TYPE "EmployeeAvailability" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('CHECKED_IN', 'CHECKED_OUT');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TicketLevel" AS ENUM ('L1', 'L2', 'L3', 'PARENT_COMPANY');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'MANAGER_REVIEW', 'CUSTOMER_FEEDBACK', 'CLOSED');

-- CreateEnum
CREATE TYPE "SLAStatus" AS ENUM ('ON_TRACK', 'WARNING', 'BREACHED', 'MET');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('INTERNAL_NOTE', 'CUSTOMER_COMMUNICATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "roles" (
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "permissions_json" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" VARCHAR(50) NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "address" TEXT NOT NULL,
    "gstn" VARCHAR(50),
    "primary_email" VARCHAR(191) NOT NULL,
    "alternate_emails" TEXT,
    "contact_person" VARCHAR(150) NOT NULL,
    "contact_phone" VARCHAR(50) NOT NULL,
    "contact_address" TEXT,
    "contact_status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "alternate_contact" VARCHAR(150),
    "alternate_contact_phone" VARCHAR(50),
    "alternate_contact_address" TEXT,
    "alternate_contact_email" VARCHAR(191),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_contacts" (
    "id" SERIAL NOT NULL,
    "company_id" VARCHAR(50) NOT NULL,
    "user_id" INTEGER,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "designation" VARCHAR(100),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" VARCHAR(50) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "designation" VARCHAR(100) NOT NULL,
    "level" "EmployeeLevel" NOT NULL,
    "manager_id" VARCHAR(50),
    "availability" "EmployeeAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_attendance" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(50) NOT NULL,
    "check_in_time" TIMESTAMP(3) NOT NULL,
    "check_out_time" TIMESTAMP(3),
    "location_lat" DOUBLE PRECISION,
    "location_lng" DOUBLE PRECISION,
    "location_address" VARCHAR(255),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" VARCHAR(50) NOT NULL,
    "company_id" VARCHAR(50) NOT NULL,
    "customer_contact_id" INTEGER NOT NULL,
    "problem_type" VARCHAR(150) NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "created_by" INTEGER NOT NULL,
    "assigned_employee_id" VARCHAR(50),
    "assigned_level" "TicketLevel" NOT NULL DEFAULT 'L1',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "sla_priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "sla_deadline" TIMESTAMP(3),
    "sla_status" "SLAStatus" NOT NULL DEFAULT 'ON_TRACK',
    "resolution_started_at" TIMESTAMP(3),
    "resolution_ended_at" TIMESTAMP(3),
    "total_resolution_seconds" INTEGER NOT NULL DEFAULT 0,
    "closed_at" TIMESTAMP(3),
    "closed_by" INTEGER,
    "closure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_assignments" (
    "id" SERIAL NOT NULL,
    "ticket_id" VARCHAR(50) NOT NULL,
    "employee_id" VARCHAR(50) NOT NULL,
    "level" "TicketLevel" NOT NULL,
    "assigned_by" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),
    "assignment_type" "AssignmentType" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "ticket_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" SERIAL NOT NULL,
    "ticket_id" VARCHAR(50) NOT NULL,
    "actor_user_id" INTEGER NOT NULL,
    "action_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "metadata_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_escalations" (
    "id" SERIAL NOT NULL,
    "ticket_id" VARCHAR(50) NOT NULL,
    "from_level" "EmployeeLevel" NOT NULL,
    "to_level" "TicketLevel" NOT NULL,
    "escalated_by_employee_id" VARCHAR(50) NOT NULL,
    "assigned_to_employee_id" VARCHAR(50),
    "reason" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_resolution_sessions" (
    "id" SERIAL NOT NULL,
    "ticket_id" VARCHAR(50) NOT NULL,
    "employee_id" VARCHAR(50) NOT NULL,
    "level" "TicketLevel" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ticket_resolution_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" SERIAL NOT NULL,
    "ticket_id" VARCHAR(50) NOT NULL,
    "author_user_id" INTEGER NOT NULL,
    "comment_type" "CommentType" NOT NULL DEFAULT 'INTERNAL_NOTE',
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" SERIAL NOT NULL,
    "ticket_id" VARCHAR(50) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "uploaded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_feedback" (
    "id" SERIAL NOT NULL,
    "ticket_id" VARCHAR(50) NOT NULL,
    "customer_user_id" INTEGER NOT NULL,
    "rating" SMALLINT NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_configurations" (
    "id" SERIAL NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "response_time_hours" DOUBLE PRECISION NOT NULL,
    "resolution_time_hours" DOUBLE PRECISION NOT NULL,
    "warning_threshold_percent" INTEGER NOT NULL DEFAULT 75,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "link_url" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" SERIAL NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" VARCHAR(191) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload_json" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(50) NOT NULL,
    "old_values_json" TEXT,
    "new_values_json" TEXT,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "setting_key" VARCHAR(100) NOT NULL,
    "setting_value" TEXT NOT NULL,
    "description" VARCHAR(255),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("setting_key")
);

-- CreateTable
CREATE TABLE "sequence_trackers" (
    "name" VARCHAR(50) NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sequence_trackers_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_companies_name" ON "companies"("company_name");

-- CreateIndex
CREATE INDEX "idx_companies_active" ON "companies"("is_active");

-- CreateIndex
CREATE INDEX "idx_contacts_company" ON "company_contacts"("company_id");

-- CreateIndex
CREATE INDEX "idx_contacts_email" ON "company_contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "idx_employees_level" ON "employees"("level");

-- CreateIndex
CREATE INDEX "idx_employees_status" ON "employees"("status");

-- CreateIndex
CREATE INDEX "idx_employees_avail" ON "employees"("availability");

-- CreateIndex
CREATE INDEX "idx_attendance_emp" ON "employee_attendance"("employee_id", "check_in_time");

-- CreateIndex
CREATE INDEX "idx_tickets_status" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "idx_tickets_company" ON "tickets"("company_id");

-- CreateIndex
CREATE INDEX "idx_tickets_contact" ON "tickets"("customer_contact_id");

-- CreateIndex
CREATE INDEX "idx_tickets_assigned" ON "tickets"("assigned_employee_id");

-- CreateIndex
CREATE INDEX "idx_tickets_priority" ON "tickets"("priority");

-- CreateIndex
CREATE INDEX "idx_tickets_created_at" ON "tickets"("created_at");

-- CreateIndex
CREATE INDEX "idx_assign_ticket" ON "ticket_assignments"("ticket_id");

-- CreateIndex
CREATE INDEX "idx_assign_emp" ON "ticket_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "idx_history_ticket" ON "ticket_history"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_escalations_ticket" ON "ticket_escalations"("ticket_id");

-- CreateIndex
CREATE INDEX "idx_sessions_ticket" ON "ticket_resolution_sessions"("ticket_id");

-- CreateIndex
CREATE INDEX "idx_comments_ticket" ON "ticket_comments"("ticket_id");

-- CreateIndex
CREATE INDEX "idx_attachments_ticket" ON "ticket_attachments"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_feedback_ticket_id_key" ON "ticket_feedback"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "sla_configurations_priority_key" ON "sla_configurations"("priority");

-- CreateIndex
CREATE INDEX "idx_notif_user_unread" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_notif_logs_channel" ON "notification_logs"("channel");

-- CreateIndex
CREATE INDEX "idx_notif_logs_sent_at" ON "notification_logs"("sent_at");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_created_at" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_attendance" ADD CONSTRAINT "employee_attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_contact_id_fkey" FOREIGN KEY ("customer_contact_id") REFERENCES "company_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_escalations" ADD CONSTRAINT "ticket_escalations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_escalations" ADD CONSTRAINT "ticket_escalations_escalated_by_employee_id_fkey" FOREIGN KEY ("escalated_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_escalations" ADD CONSTRAINT "ticket_escalations_assigned_to_employee_id_fkey" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_resolution_sessions" ADD CONSTRAINT "ticket_resolution_sessions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_resolution_sessions" ADD CONSTRAINT "ticket_resolution_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_feedback" ADD CONSTRAINT "ticket_feedback_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_feedback" ADD CONSTRAINT "ticket_feedback_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

