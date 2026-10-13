ALTER TABLE `clients` ADD `block_status` varchar(32) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `blocked_at` varchar(35);--> statement-breakpoint
ALTER TABLE `clients` ADD `last_paid_at` varchar(35);