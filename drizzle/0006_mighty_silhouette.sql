CREATE TABLE `client_phones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`client_id` int NOT NULL,
	`label` varchar(50) NOT NULL DEFAULT '',
	`phone` varchar(40) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` varchar(35) NOT NULL,
	CONSTRAINT `client_phones_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_client_phones_client_phone` UNIQUE(`client_id`,`phone`)
);
--> statement-breakpoint
ALTER TABLE `financial_transactions` ADD `status` varchar(24) DEFAULT 'realized' NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_transactions` ADD `settled_date` varchar(10);--> statement-breakpoint
UPDATE `financial_transactions` SET `settled_date` = `transaction_date` WHERE `status` = 'realized' AND `settled_date` IS NULL;--> statement-breakpoint
ALTER TABLE `client_phones` ADD CONSTRAINT `client_phones_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_client_phones_client` ON `client_phones` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_client_phones_organization` ON `client_phones` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_financial_transactions_org_status` ON `financial_transactions` (`organization_id`,`status`);
