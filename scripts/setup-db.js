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
