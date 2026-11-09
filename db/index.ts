import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { parseLegacyClientDevices } from '@/lib/client-device';
import * as schema from './schema';

const globalDatabase = globalThis as unknown as {
  arGestorMySqlPool?: Pool;
  arGestorClientDevicesSchema?: Promise<boolean>;
  arGestorLegacyDevicesMigration?: Promise<number>;
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
    location varchar(191) NOT NULL DEFAULT '',
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
        const [locationColumns] = await getPool().query<RowDataPacket[]>(`
          SELECT 1
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'client_devices'
            AND COLUMN_NAME = 'location'
          LIMIT 1
        `);
        if (!locationColumns.length) {
          await getPool().query(`
            ALTER TABLE client_devices
            ADD COLUMN location varchar(191) NOT NULL DEFAULT '' AFTER device
          `);
        }
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

type LegacyClientRow = RowDataPacket & {
  id: number;
  organization_id: number;
  observation: string;
};

type LockRow = RowDataPacket & { acquired: number };

export async function migrateLegacyClientDevices() {
  if (!globalDatabase.arGestorLegacyDevicesMigration) {
    globalDatabase.arGestorLegacyDevicesMigration = (async () => {
      if (!await ensureClientDevicesSchema()) return 0;
      const connection = await getPool().getConnection();
      let lockAcquired = false;
      try {
        const [lockRows] = await connection.query<LockRow[]>('SELECT GET_LOCK(?, 30) AS acquired', ['ar_gestor_pro_legacy_devices']);
        lockAcquired = Number(lockRows[0]?.acquired) === 1;
        if (!lockAcquired) return 0;

        const [clients] = await connection.query<LegacyClientRow[]>(`
          SELECT c.id, c.organization_id, c.observation
          FROM clients c
          WHERE c.observation <> ''
            AND NOT EXISTS (SELECT 1 FROM client_devices d WHERE d.client_id = c.id)
        `);

        let inserted = 0;
        const createdAt = new Date().toISOString();
        for (const client of clients) {
          const devices = parseLegacyClientDevices(client.observation);
          for (const [sortOrder, device] of devices.entries()) {
            try {
              const [result] = await connection.execute<ResultSetHeader>(`
                INSERT INTO client_devices
                  (organization_id, client_id, tv, app, mac_address, device, location, sort_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [client.organization_id, client.id, device.tv, device.app, device.macAddress || null, device.device, device.location, sortOrder, createdAt]);
              inserted += result.affectedRows;
            } catch (error) {
              const duplicateMac = typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
              if (!duplicateMac || !device.macAddress) throw error;
              const [result] = await connection.execute<ResultSetHeader>(`
                INSERT INTO client_devices
                  (organization_id, client_id, tv, app, mac_address, device, location, sort_order, created_at)
                VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)
              `, [client.organization_id, client.id, device.tv, device.app, device.device, device.location, sortOrder, createdAt]);
              inserted += result.affectedRows;
            }
          }
        }
        console.log(`[database] ${inserted} dispositivo(s) antigo(s) organizado(s).`);
        return inserted;
      } catch (error) {
        globalDatabase.arGestorLegacyDevicesMigration = undefined;
        console.error('[database] Falha ao organizar dispositivos antigos:', error instanceof Error ? error.message : error);
        return 0;
      } finally {
        if (lockAcquired) await connection.query('SELECT RELEASE_LOCK(?)', ['ar_gestor_pro_legacy_devices']);
        connection.release();
      }
    })();
  }
  return globalDatabase.arGestorLegacyDevicesMigration;
}
