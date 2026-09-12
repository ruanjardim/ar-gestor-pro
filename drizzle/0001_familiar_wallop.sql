CREATE TABLE `financial_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`client_id` int,
	`created_by` int,
	`type` varchar(24) NOT NULL,
	`category` varchar(100) NOT NULL,
	`description` varchar(300) NOT NULL,
	`amount` double NOT NULL,
	`transaction_date` varchar(10) NOT NULL,
	`source` varchar(32) NOT NULL DEFAULT 'manual',
	`created_at` varchar(35) NOT NULL,
	CONSTRAINT `financial_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `finance_access` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_transactions` ADD CONSTRAINT `financial_transactions_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_transactions` ADD CONSTRAINT `financial_transactions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_financial_transactions_org_date` ON `financial_transactions` (`organization_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_financial_transactions_client` ON `financial_transactions` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_financial_transactions_created_by` ON `financial_transactions` (`created_by`);