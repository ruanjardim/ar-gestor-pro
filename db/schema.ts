import {
  boolean,
  double,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

export const organizations = mysqlTable('organizations', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }).notNull(),
  slug: varchar('slug', { length: 191 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  plan: varchar('plan', { length: 32 }).notNull().default('standard'),
  createdAt: varchar('created_at', { length: 35 }).notNull(),
}, (table) => [uniqueIndex('idx_organizations_slug').on(table.slug)]);

export const categories = mysqlTable('categories', {
  id: int('id').autoincrement().primaryKey(),
  organizationId: int('organization_id').notNull(),
  name: varchar('name', { length: 191 }).notNull(),
}, (table) => [uniqueIndex('idx_categories_org_name').on(table.organizationId, table.name)]);

export const clients = mysqlTable('clients', {
  id: int('id').autoincrement().primaryKey(),
  organizationId: int('organization_id').notNull(),
  name: varchar('name', { length: 191 }).notNull(),
  phone: varchar('phone', { length: 40 }).notNull(),
  telegramChatId: varchar('telegram_chat_id', { length: 100 }),
  categoryId: int('category_id').references(() => categories.id, { onDelete: 'set null' }),
  observation: text('observation').notNull(),
  dueDate: varchar('due_date', { length: 10 }).notNull(),
  amount: double('amount').notNull().default(0),
  createdAt: varchar('created_at', { length: 35 }).notNull().default(''),
}, (table) => [
  index('idx_clients_due_date').on(table.dueDate),
  index('idx_clients_name').on(table.name),
  index('idx_clients_category_id').on(table.categoryId),
  index('idx_clients_organization_id').on(table.organizationId),
]);

export const notes = mysqlTable('notes', {
  id: int('id').autoincrement().primaryKey(),
  organizationId: int('organization_id').notNull(),
  title: varchar('title', { length: 191 }).notNull(),
  content: text('content').notNull(),
  createdAt: varchar('created_at', { length: 35 }).notNull().default(''),
});

export const settings = mysqlTable('settings', {
  key: varchar('key', { length: 191 }).primaryKey(),
  value: text('value').notNull(),
});

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  organizationId: int('organization_id').notNull(),
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  financeAccess: boolean('finance_access').notNull().default(false),
  name: varchar('name', { length: 191 }).notNull(),
  email: varchar('email', { length: 254 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 32 }).notNull().default('member'),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  createdAt: varchar('created_at', { length: 35 }).notNull(),
  lastLoginAt: varchar('last_login_at', { length: 35 }),
  createdBy: int('created_by'),
}, (table) => [
  uniqueIndex('idx_users_email').on(table.email),
  index('idx_users_organization_id').on(table.organizationId),
]);

export const sessions = mysqlTable('sessions', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: varchar('expires_at', { length: 35 }).notNull(),
  createdAt: varchar('created_at', { length: 35 }).notNull(),
}, (table) => [
  uniqueIndex('idx_sessions_token_hash').on(table.tokenHash),
  index('idx_sessions_user_id').on(table.userId),
  index('idx_sessions_expires_at').on(table.expiresAt),
]);

export const auditLogs = mysqlTable('audit_logs', {
  id: int('id').autoincrement().primaryKey(),
  organizationId: int('organization_id').notNull(),
  userId: int('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }),
  details: varchar('details', { length: 500 }).notNull().default(''),
  createdAt: varchar('created_at', { length: 35 }).notNull(),
}, (table) => [
  index('idx_audit_logs_user_id').on(table.userId),
  index('idx_audit_logs_created_at').on(table.createdAt),
  index('idx_audit_logs_organization_id').on(table.organizationId),
]);

export const whatsappConnections = mysqlTable('whatsapp_connections', {
  id: int('id').autoincrement().primaryKey(),
  organizationId: int('organization_id').notNull(),
  provider: varchar('provider', { length: 32 }).notNull(),
  displayPhone: varchar('display_phone', { length: 40 }).notNull().default(''),
  secretData: text('secret_data').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('configured'),
  verifiedName: varchar('verified_name', { length: 191 }).notNull().default(''),
  lastCheckedAt: varchar('last_checked_at', { length: 35 }),
  updatedAt: varchar('updated_at', { length: 35 }).notNull(),
}, (table) => [uniqueIndex('idx_whatsapp_connections_org').on(table.organizationId)]);

export const messageLogs = mysqlTable('message_logs', {
  id: int('id').autoincrement().primaryKey(),
  organizationId: int('organization_id').notNull(),
  clientId: int('client_id'),
  kind: varchar('kind', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  recipient: varchar('recipient', { length: 40 }).notNull(),
  messagePreview: varchar('message_preview', { length: 500 }).notNull().default(''),
  providerMessageId: varchar('provider_message_id', { length: 191 }),
  error: varchar('error', { length: 500 }).notNull().default(''),
  scheduledFor: varchar('scheduled_for', { length: 35 }),
  createdAt: varchar('created_at', { length: 35 }).notNull(),
}, (table) => [
  index('idx_message_logs_organization_id').on(table.organizationId),
  index('idx_message_logs_created_at').on(table.createdAt),
  index('idx_message_logs_schedule').on(table.organizationId, table.clientId, table.kind, table.scheduledFor),
]);

export const loginAttempts = mysqlTable('login_attempts', {
  key: varchar('key', { length: 64 }).primaryKey(),
  failures: int('failures').notNull().default(0),
  blockedUntil: varchar('blocked_until', { length: 35 }),
  updatedAt: varchar('updated_at', { length: 35 }).notNull(),
});

export const financialTransactions = mysqlTable('financial_transactions', {
  id: int('id').autoincrement().primaryKey(),
  organizationId: int('organization_id').notNull(),
  clientId: int('client_id').references(() => clients.id, { onDelete: 'set null' }),
  createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 24 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  description: varchar('description', { length: 300 }).notNull(),
  amount: double('amount').notNull(),
  transactionDate: varchar('transaction_date', { length: 10 }).notNull(),
  source: varchar('source', { length: 32 }).notNull().default('manual'),
  createdAt: varchar('created_at', { length: 35 }).notNull(),
}, (table) => [
  index('idx_financial_transactions_org_date').on(table.organizationId, table.transactionDate),
  index('idx_financial_transactions_client').on(table.clientId),
  index('idx_financial_transactions_created_by').on(table.createdBy),
]);
