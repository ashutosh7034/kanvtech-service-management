-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "prospects" ADD COLUMN     "converted_at" TIMESTAMP(3),
ADD COLUMN     "converted_by_user_id" INTEGER,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_email_verify_user" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_email_verify_token" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_prospects_status" ON "prospects"("status");

-- CreateIndex
CREATE INDEX "idx_prospects_email" ON "prospects"("email");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
