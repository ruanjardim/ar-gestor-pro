import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type Pool } from 'mysql2/promise';
import * as schema from './schema';

const globalDatabase = globalThis as unknown as { arGestorMySqlPool?: Pool };

function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!globalDatabase.arGestorMySqlPool) {
    const host = process.env.DB_HOST;
    const database = process.env.DB_NAME;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    if (!databaseUrl && (!host || !database || !user || !password)) {
      throw new Error('O banco MySQL ainda não foi configurado. Defina DATABASE_URL ou DB_HOST, DB_NAME, DB_USER e DB_PASSWORD na Hostinger.');
    }
    globalDatabase.arGestorMySqlPool = mysql.createPool({
      ...(databaseUrl ? { uri: databaseUrl } : {
        host,
        port: Number(process.env.DB_PORT || 3306),
        database,
        user,
        password,
      }),
      connectionLimit: 5,
      enableKeepAlive: true,
      waitForConnections: true,
    });
  }
  return globalDatabase.arGestorMySqlPool;
}

export function getDb() {
  return drizzle(getPool(), { schema, mode: 'default' });
}
