-- AlterTable
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "specialization_json" TEXT;

-- AlterTable
ALTER TABLE "employee_tasks" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "task_type" VARCHAR(50) NOT NULL DEFAULT 'SELF TASK',
ADD COLUMN IF NOT EXISTS "reminder_triggered_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_emp_tasks_reminder" ON "employee_tasks"("reminder_time", "status", "reminder_triggered_at");
