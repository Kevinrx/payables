ALTER TYPE "public"."bill_event" ADD VALUE 'released';--> statement-breakpoint
ALTER TYPE "public"."bill_event" ADD VALUE 'canceled';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'processing' BEFORE 'paid';