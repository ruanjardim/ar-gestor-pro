import mysql from 'mysql2/promise';

const clientDevicesMigrationName = '0004_client_devices';
const deviceLocationMigrationName = '0005_client_device_location';
const clientPhonesMigrationName = '0006_client_phones';
const financialPlanningMigrationName = '0007_financial_planning';
const lockName = 'ar_gestor_pro_schema_migrations';

function databaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) return { uri: databaseUrl };

  const host = process.env.DB_HOST;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  if (!host || !database || !user || !password) {
    throw new Error('Banco não configurado: defina DATABASE_URL ou DB_HOST, DB_NAME, DB_USER e DB_PASSWORD.');
  }

  return {
    host,
    port: Number(process.env.DB_PORT || 3306),
    database,
    user,
    password,
  };
}

async function run() {
  const connection = await mysql.createConnection(databaseConfig());
  let lockAcquired = false;

  try {
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 30) AS acquired', [lockName]);
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) throw new Error('Não foi possível obter o bloqueio das migrações em 30 segundos.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_schema_migrations (
        name varchar(191) NOT NULL,
        applied_at varchar(35) NOT NULL,
        CONSTRAINT app_schema_migrations_name PRIMARY KEY (name)
      )
    `);

    const [appliedRows] = await connection.query(
      'SELECT name FROM app_schema_migrations WHERE name = ? LIMIT 1',
      [clientDevicesMigrationName],
    );

    if (!appliedRows.length) {
      await connection.query(`
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
      `);

      await connection.query(
        'INSERT IGNORE INTO app_schema_migrations (name, applied_at) VALUES (?, ?)',
        [clientDevicesMigrationName, new Date().toISOString()],
      );
      console.log(`[migrations] ${clientDevicesMigrationName} aplicada com sucesso.`);
    } else {
      console.log(`[migrations] ${clientDevicesMigrationName} já estava aplicada.`);
    }

    const [locationMigrationRows] = await connection.query(
      'SELECT name FROM app_schema_migrations WHERE name = ? LIMIT 1',
      [deviceLocationMigrationName],
    );

    if (!locationMigrationRows.length) {
      const [locationColumns] = await connection.query(`
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'client_devices'
          AND COLUMN_NAME = 'location'
        LIMIT 1
      `);
      if (!locationColumns.length) {
        await connection.query(`
          ALTER TABLE client_devices
          ADD COLUMN location varchar(191) NOT NULL DEFAULT '' AFTER device
        `);
      }
      await connection.query(
        'INSERT IGNORE INTO app_schema_migrations (name, applied_at) VALUES (?, ?)',
        [deviceLocationMigrationName, new Date().toISOString()],
      );
      console.log(`[migrations] ${deviceLocationMigrationName} aplicada com sucesso.`);
    } else {
      console.log(`[migrations] ${deviceLocationMigrationName} já estava aplicada.`);
    }

    const [phoneMigrationRows] = await connection.query(
      'SELECT name FROM app_schema_migrations WHERE name = ? LIMIT 1',
      [clientPhonesMigrationName],
    );

    if (!phoneMigrationRows.length) {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS client_phones (
          id int AUTO_INCREMENT NOT NULL,
          organization_id int NOT NULL,
          client_id int NOT NULL,
          label varchar(50) NOT NULL DEFAULT '',
          phone varchar(40) NOT NULL,
          sort_order int NOT NULL DEFAULT 0,
          created_at varchar(35) NOT NULL,
          CONSTRAINT client_phones_id PRIMARY KEY (id),
          CONSTRAINT idx_client_phones_client_phone UNIQUE (client_id, phone),
          CONSTRAINT client_phones_client_id_clients_id_fk
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE ON UPDATE NO ACTION,
          INDEX idx_client_phones_client (client_id),
          INDEX idx_client_phones_organization (organization_id)
        )
      `);
      await connection.query(`
        INSERT IGNORE INTO client_phones
          (organization_id, client_id, label, phone, sort_order, created_at)
        SELECT organization_id, id, 'Principal', phone, 0, ?
        FROM clients
        WHERE phone <> ''
      `, [new Date().toISOString()]);
      await connection.query(
        'INSERT IGNORE INTO app_schema_migrations (name, applied_at) VALUES (?, ?)',
        [clientPhonesMigrationName, new Date().toISOString()],
      );
      console.log(`[migrations] ${clientPhonesMigrationName} aplicada com sucesso.`);
    } else {
      console.log(`[migrations] ${clientPhonesMigrationName} já estava aplicada.`);
    }

    const [financialMigrationRows] = await connection.query(
      'SELECT name FROM app_schema_migrations WHERE name = ? LIMIT 1',
      [financialPlanningMigrationName],
    );

    if (!financialMigrationRows.length) {
      const [financialColumns] = await connection.query(`
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'financial_transactions'
          AND COLUMN_NAME IN ('status', 'settled_date')
      `);
      const columnNames = new Set(financialColumns.map((column) => String(column.COLUMN_NAME)));
      if (!columnNames.has('status')) {
        await connection.query(`
          ALTER TABLE financial_transactions
          ADD COLUMN status varchar(24) NOT NULL DEFAULT 'realized' AFTER transaction_date
        `);
      }
      if (!columnNames.has('settled_date')) {
        await connection.query(`
          ALTER TABLE financial_transactions
          ADD COLUMN settled_date varchar(10) NULL AFTER status
        `);
      }
      await connection.query(`
        UPDATE financial_transactions
        SET settled_date = transaction_date
        WHERE status = 'realized' AND settled_date IS NULL
      `);
      const [financialIndexes] = await connection.query(`
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'financial_transactions'
          AND INDEX_NAME = 'idx_financial_transactions_org_status'
        LIMIT 1
      `);
      if (!financialIndexes.length) {
        await connection.query(`
          ALTER TABLE financial_transactions
          ADD INDEX idx_financial_transactions_org_status (organization_id, status)
        `);
      }
      await connection.query(
        'INSERT IGNORE INTO app_schema_migrations (name, applied_at) VALUES (?, ?)',
        [financialPlanningMigrationName, new Date().toISOString()],
      );
      console.log(`[migrations] ${financialPlanningMigrationName} aplicada com sucesso.`);
    } else {
      console.log(`[migrations] ${financialPlanningMigrationName} já estava aplicada.`);
    }
  } finally {
    if (lockAcquired) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    await connection.end();
  }
}

run().catch((error) => {
  console.error('[migrations] Falha ao preparar o banco:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
