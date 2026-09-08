import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const organizations = sqliteTable('organizations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  status: text('status').notNull().default('active'),
  plan: text('plan').notNull().default('standard'),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_organizations_slug').on(table.slug)]);

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull(),
  name: text('name').notNull(),
}, (table) => [uniqueIndex('idx_categories_org_name').on(table.organizationId, table.name)]);

export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  telegramChatId: text('telegram_chat_id'),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  observation: text('observation').notNull().default(''),
  dueDate: text('due_date').notNull(),
  amount: real('amount').notNull().default(0),
  createdAt: text('created_at').notNull().default(''),
}, (table) => [
  index('idx_clients_due_date').on(table.dueDate),
  index('idx_clients_name').on(table.name),
  index('idx_clients_category_id').on(table.categoryId),
  index('idx_clients_organization_id').on(table.organizationId),
]);

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(''),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull(),
  isPlatformAdmin: integer('is_platform_admin', { mode: 'boolean' }).notNull().default(false),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  lastLoginAt: text('last_login_at'),
  createdBy: integer('created_by'),
}, (table) => [
  uniqueIndex('idx_users_email').on(table.email),
  index('idx_users_organization_id').on(table.organizationId),
]);

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_sessions_token_hash').on(table.tokenHash),
  index('idx_sessions_user_id').on(table.userId),
  index('idx_sessions_expires_at').on(table.expiresAt),
]);

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: text('details').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_audit_logs_user_id').on(table.userId),
  index('idx_audit_logs_created_at').on(table.createdAt),
  index('idx_audit_logs_organization_id').on(table.organizationId),
]);

export const whatsappConnections = sqliteTable('whatsapp_connections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull(),
  provider: text('provider').notNull(),
  displayPhone: text('display_phone').notNull().default(''),
  secretData: text('secret_data').notNull(),
  status: text('status').notNull().default('configured'),
  verifiedName: text('verified_name').notNull().default(''),
  lastCheckedAt: text('last_checked_at'),
  updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_whatsapp_connections_org').on(table.organizationId)]);

export const messageLogs = sqliteTable('message_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull(),
  clientId: integer('client_id'),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
  recipient: text('recipient').notNull(),
  messagePreview: text('message_preview').notNull().default(''),
  providerMessageId: text('provider_message_id'),
  error: text('error').notNull().default(''),
  scheduledFor: text('scheduled_for'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_message_logs_organization_id').on(table.organizationId),
  index('idx_message_logs_created_at').on(table.createdAt),
  index('idx_message_logs_schedule').on(table.organizationId, table.clientId, table.kind, table.scheduledFor),
]);

export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(),
  failures: integer('failures').notNull().default(0),
  blockedUntil: text('blocked_until'),
  updatedAt: text('updated_at').notNull(),
});
