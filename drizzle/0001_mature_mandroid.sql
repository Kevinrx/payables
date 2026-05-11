ALTER TABLE "bills" ADD COLUMN "parent_bill_id" uuid;--> statement-breakpoint
CREATE INDEX "bills_parent_idx" ON "bills" USING btree ("parent_bill_id");