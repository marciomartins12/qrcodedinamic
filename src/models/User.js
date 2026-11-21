'use strict';

const { query } = require('../config/database');

/**
 * Model responsavel por tudo que toca a tabela `users`.
 */
const User = {
  async findByEmail(email) {
    const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async create({ name, email, passwordHash }) {
    const result = await query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash]
    );
    return result.insertId;
  },

  async updatePassword(id, passwordHash) {
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  },

  async updateProfile(id, { name, email }) {
    await query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, id]);
  },

  async registerLogin(id) {
    await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
  },

  async count() {
    const rows = await query('SELECT COUNT(*) AS total FROM users');
    return Number(rows[0].total);
  }
};

module.exports = User;
