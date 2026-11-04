import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type Pool } from 'mysql2/promise';
import * as schema from './schema';

const globalDatabase = globalThis as unknown as {
  arGestorMySqlPool?: Pool;
  arGestorClientDevicesSchema?: Promise<boolean>;
};

const clientDevicesSchemaSql = `
  CREATE TABLE IF NOT EXISTS client_devices (
    id int AUTO_INCREMENT NOT NULL,
    organization_id int NOT NULL,
    client_id int NOT NULL,
    tv varchar(191) NOT NULL DEFAULT '',
    app varchar(191) NOT NULL DEFAULT '',
    mac_address varchar(17),
    device varchar(191) NOT NULL DEFAULT '',
    sort_order int NOT NULL DEFAULT 0,
    created_at varchar(35) NOT NULL,
    CONSTRAINT client_devices_id PRIMARY KEY (id),
    CONSTRAINT idx_client_devices_org_mac UNIQUE (organization_id, mac_address),
    CONSTRAINT client_devices_client_id_clients_id_fk
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    INDEX idx_client_devices_client (client_id),
    INDEX idx_client_devices_organization (organization_id)
  )
`;

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

export async function ensureClientDevicesSchema() {
  if (!globalDatabase.arGestorClientDevicesSchema) {
    globalDatabase.arGestorClientDevicesSchema = (async () => {
      try {
        await getPool().query(clientDevicesSchemaSql);
        return true;
      } catch (error) {
        globalDatabase.arGestorClientDevicesSchema = undefined;
        console.error('[database] Não foi possível preparar client_devices:', error instanceof Error ? error.message : error);
        return false;
      }
    })();
  }
  return globalDatabase.arGestorClientDevicesSchema;
}
