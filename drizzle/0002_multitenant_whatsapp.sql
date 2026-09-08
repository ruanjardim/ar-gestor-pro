CREATE TABLE `organizations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `plan` text DEFAULT 'standard' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organizations_slug` ON `organizations` (`slug`);
--> statement-breakpoint
INSERT INTO `organizations` (`id`,`name`,`slug`,`status`,`plan`,`created_at`) VALUES (1,'AR Gestor Pro','ar-gestor-pro','active','internal','2026-09-04T00:00:00.000Z');
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `organization_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `is_platform_admin` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `users` SET `organization_id`=1;
--> statement-breakpoint
UPDATE `users` SET `is_platform_admin`=1 WHERE `email`='ruan.sjardim@gmail.com';
--> statement-breakpoint
CREATE INDEX `idx_users_organization_id` ON `users` (`organization_id`);
--> statement-breakpoint
ALTER TABLE `categories` ADD COLUMN `organization_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
DROP INDEX `idx_categories_name`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_org_name` ON `categories` (`organization_id`,`name`);
--> statement-breakpoint
ALTER TABLE `clients` ADD COLUMN `organization_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_clients_organization_id` ON `clients` (`organization_id`);
--> statement-breakpoint
ALTER TABLE `notes` ADD COLUMN `organization_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD COLUMN `organization_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_organization_id` ON `audit_logs` (`organization_id`);
--> statement-breakpoint
INSERT INTO `settings` (`key`,`value`) SELECT '1:' || `key`,`value` FROM `settings` WHERE `key` NOT LIKE '1:%';
--> statement-breakpoint
CREATE TABLE `whatsapp_connections` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `organization_id` integer NOT NULL,
  `provider` text NOT NULL,
  `display_phone` text DEFAULT '' NOT NULL,
  `secret_data` text NOT NULL,
  `status` text DEFAULT 'configured' NOT NULL,
  `verified_name` text DEFAULT '' NOT NULL,
  `last_checked_at` text,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_whatsapp_connections_org` ON `whatsapp_connections` (`organization_id`);
--> statement-breakpoint
CREATE TABLE `message_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `organization_id` integer NOT NULL,
  `client_id` integer,
  `kind` text NOT NULL,
  `status` text NOT NULL,
  `recipient` text NOT NULL,
  `message_preview` text DEFAULT '' NOT NULL,
  `provider_message_id` text,
  `error` text DEFAULT '' NOT NULL,
  `scheduled_for` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_message_logs_organization_id` ON `message_logs` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `idx_message_logs_created_at` ON `message_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_message_logs_schedule` ON `message_logs` (`organization_id`,`client_id`,`kind`,`scheduled_for`);
