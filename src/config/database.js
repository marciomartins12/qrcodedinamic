'use strict';

const mysql = require('mysql2/promise');
const env = require('./env');

/**
 * Pool unico de conexoes reaproveitado por toda a aplicacao.
 */
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  // DECIMAL volta como number (size_cm) em vez de string.
  decimalNumbers: true,
  // Mantem as datas como string "YYYY-MM-DD HH:mm:ss" (mais simples de exibir).
  dateStrings: true
});

/**
 * Atalho para consultas simples. Retorna apenas as linhas.
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Garante que o banco esta acessivel antes de subir o servidor.
 */
async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, testConnection, closePool };
