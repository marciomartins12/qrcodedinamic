'use strict';

/**
 * Cria o banco, as tabelas e o usuario administrador inicial.
 *
 *   npm run db:setup
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbName = process.env.DB_NAME || 'plaquinhas';
const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.ADMIN_PASSWORD || '');
const adminName = String(process.env.ADMIN_NAME || 'Administrador').trim();

/**
 * Adiciona uma coluna apenas se ela ainda nao existir, para que o setup possa
 * rodar tambem em bancos criados por versoes anteriores (sem quebrar nada).
 */
async function ensureColumn(connection, column, definition) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'qrcodes' AND column_name = ?`,
    [column]
  );

  if (Number(rows[0].total) === 0) {
    await connection.query(`ALTER TABLE \`qrcodes\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`      coluna qrcodes.${column} adicionada.`);
  }
}

/** Cria o indice apenas se ainda nao existir. */
async function ensureIndex(connection, indexName, columns) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'qrcodes' AND index_name = ?`,
    [indexName]
  );

  if (Number(rows[0].total) === 0) {
    await connection.query(`ALTER TABLE \`qrcodes\` ADD INDEX \`${indexName}\` (${columns})`);
    console.log(`      indice qrcodes.${indexName} criado.`);
  }
}

async function run() {
  if (!adminEmail || !adminPassword) {
    console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD no arquivo .env antes de rodar o setup.');
    process.exit(1);
  }

  if (adminPassword.length < 8) {
    console.error('A senha do administrador precisa ter no minimo 8 caracteres.');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');

    console.log('[1/3] criando banco e tabelas...');
    await connection.query(schema);
    await connection.query(`USE \`${dbName}\``);

    // Compatibilidade com bancos criados antes: o link de destino passou a ser
    // opcional (cria-se a placa primeiro e configura o destino depois).
    await connection.query('ALTER TABLE `qrcodes` MODIFY `target_url` VARCHAR(2048) NULL DEFAULT NULL');

    // Suporte a QR Code do Pix (adicionado depois da primeira versao).
    await ensureColumn(connection, 'type', "ENUM('link','pix') NOT NULL DEFAULT 'link' AFTER `code`");
    await ensureColumn(connection, 'pix_key', 'VARCHAR(77) NULL DEFAULT NULL');
    await ensureColumn(connection, 'pix_key_kind', 'VARCHAR(12) NULL DEFAULT NULL');
    await ensureColumn(connection, 'pix_name', 'VARCHAR(25) NULL DEFAULT NULL');
    await ensureColumn(connection, 'pix_city', 'VARCHAR(15) NULL DEFAULT NULL');
    await ensureColumn(connection, 'pix_payload', 'VARCHAR(512) NULL DEFAULT NULL');
    await ensureIndex(connection, 'idx_qrcodes_type', '`type`');

    console.log('      banco e tabelas prontos.');

    console.log('[2/3] verificando usuario administrador...');
    const [existing] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]);

    if (existing.length > 0) {
      console.log(`      usuario ${adminEmail} ja existe (nada alterado).`);
    } else {
      const hash = await bcrypt.hash(adminPassword, 10);
      await connection.query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [adminName, adminEmail, hash]
      );
      console.log(`      usuario ${adminEmail} criado.`);
    }

    console.log('[3/3] pronto.');
    console.log('');
    console.log('Acesse o painel em: /admin/login');
    process.exit(0);
  } catch (error) {
    console.error('Falha no setup:', error.message);
    process.exit(1);
  } finally {
    await connection.end().catch(() => {});
  }
}

run();
