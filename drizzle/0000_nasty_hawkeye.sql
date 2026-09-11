CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`user_id` int,
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(100) NOT NULL,
	`entity_id` varchar(100),
	`details` varchar(500) NOT NULL DEFAULT '',
	`created_at` varchar(35) NOT NULL,
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`name` varchar(191) NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_categories_org_name` UNIQUE(`organization_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`name` varchar(191) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`telegram_chat_id` varchar(100),
	`category_id` int,
	`observation` text NOT NULL,
	`due_date` varchar(10) NOT NULL,
	`amount` double NOT NULL DEFAULT 0,
	`created_at` varchar(35) NOT NULL DEFAULT '',
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`key` varchar(64) NOT NULL,
	`failures` int NOT NULL DEFAULT 0,
	`blocked_until` varchar(35),
	`updated_at` varchar(35) NOT NULL,
	CONSTRAINT `login_attempts_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `message_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`client_id` int,
	`kind` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`recipient` varchar(40) NOT NULL,
	`message_preview` varchar(500) NOT NULL DEFAULT '',
	`provider_message_id` varchar(191),
	`error` varchar(500) NOT NULL DEFAULT '',
	`scheduled_for` varchar(35),
	`created_at` varchar(35) NOT NULL,
	CONSTRAINT `message_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`title` varchar(191) NOT NULL,
	`content` text NOT NULL,
	`created_at` varchar(35) NOT NULL DEFAULT '',
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`plan` varchar(32) NOT NULL DEFAULT 'standard',
	`created_at` varchar(35) NOT NULL,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_organizations_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` varchar(35) NOT NULL,
	`created_at` varchar(35) NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_sessions_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(191) NOT NULL,
	`value` text NOT NULL,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`is_platform_admin` boolean NOT NULL DEFAULT false,
	`name` varchar(191) NOT NULL,
	`email` varchar(254) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(32) NOT NULL DEFAULT 'member',
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`created_at` varchar(35) NOT NULL,
	`last_login_at` varchar(35),
	`created_by` int,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_users_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`provider` varchar(32) NOT NULL,
	`display_phone` varchar(40) NOT NULL DEFAULT '',
	`secret_data` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'configured',
	`verified_name` varchar(191) NOT NULL DEFAULT '',
	`last_checked_at` varchar(35),
	`updated_at` varchar(35) NOT NULL,
	CONSTRAINT `whatsapp_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_whatsapp_connections_org` UNIQUE(`organization_id`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_logs_user_id` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_organization_id` ON `audit_logs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_clients_due_date` ON `clients` (`due_date`);--> statement-breakpoint
CREATE INDEX `idx_clients_name` ON `clients` (`name`);--> statement-breakpoint
CREATE INDEX `idx_clients_category_id` ON `clients` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_clients_organization_id` ON `clients` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_message_logs_organization_id` ON `message_logs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_message_logs_created_at` ON `message_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_message_logs_schedule` ON `message_logs` (`organization_id`,`client_id`,`kind`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_users_organization_id` ON `users` (`organization_id`);