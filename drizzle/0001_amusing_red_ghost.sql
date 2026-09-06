CREATE TYPE "public"."user_status" AS ENUM('PENDING', 'ACTIVE');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'ACTIVE' NOT NULL;