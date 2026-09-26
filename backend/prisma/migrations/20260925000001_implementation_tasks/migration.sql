-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "implementation_tasks" (
    "id" VARCHAR(50) NOT NULL,
    "implementation_id" VARCHAR(50) NOT NULL,
    "task_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "priority" VARCHAR(50) DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "completed_by" INTEGER,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "implementation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_impl_tasks_impl" ON "implementation_tasks"("implementation_id");

-- CreateIndex
CREATE INDEX "idx_impl_tasks_status" ON "implementation_tasks"("status");

-- AddForeignKey
ALTER TABLE "implementation_tasks" ADD CONSTRAINT "implementation_tasks_implementation_id_fkey" FOREIGN KEY ("implementation_id") REFERENCES "implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementation_tasks" ADD CONSTRAINT "implementation_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
