import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
}, (table) => [uniqueIndex('idx_categories_name').on(table.name)]);

export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
]);

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(''),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
