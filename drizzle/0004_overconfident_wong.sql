ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "reports_week_start_idx" ON "reports" USING btree ("week_start" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_assigned_manager_id_idx" ON "reports" USING btree ("assigned_manager_id");--> statement-breakpoint
CREATE INDEX "review_comments_version_id_idx" ON "review_comments" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "review_comments_created_at_idx" ON "review_comments" USING btree ("created_at");