CREATE TABLE `client_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`client_id` int NOT NULL,
	`tv` varchar(191) NOT NULL DEFAULT '',
	`app` varchar(191) NOT NULL DEFAULT '',
	`mac_address` varchar(17),
	`device` varchar(191) NOT NULL DEFAULT '',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` varchar(35) NOT NULL,
	CONSTRAINT `client_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_client_devices_org_mac` UNIQUE(`organization_id`,`mac_address`)
);
--> statement-breakpoint
ALTER TABLE `client_devices` ADD CONSTRAINT `client_devices_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_client_devices_client` ON `client_devices` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_client_devices_organization` ON `client_devices` (`organization_id`);