ALTER TABLE "project_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "project_members" CASCADE;--> statement-breakpoint
CREATE INDEX "reports_project_id_idx" ON "reports" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "review_comments_report_id_idx" ON "review_comments" USING btree ("report_id");