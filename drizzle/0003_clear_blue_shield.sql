ALTER TABLE `clients` ADD `billing_status` varchar(32) DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `billing_reason` varchar(500) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `billing_started_at` varchar(35);--> statement-breakpoint
ALTER TABLE `clients` ADD `billing_ends_at` varchar(10);