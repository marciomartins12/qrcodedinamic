'use strict';

const { query } = require('../config/database');

const SORTABLE = {
  created_at: 'created_at',
  title: 'title',
  clicks: 'clicks',
  code: 'code'
};

/**
 * Model responsavel por tudo que toca a tabela `qrcodes`.
 */
const QrCode = {
  async create({ code, type, title, description, targetUrl, pixKey, pixKeyKind, pixName, pixCity, pixPayload, color, sizeCm }) {
    const result = await query(
      `INSERT INTO qrcodes
         (code, type, title, description, target_url, pix_key, pix_key_kind, pix_name, pix_city, pix_payload, color, size_cm)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, type, title, description, targetUrl, pixKey, pixKeyKind, pixName, pixCity, pixPayload, color, sizeCm]
    );
    return result.insertId;
  },

  async findById(id) {
    const rows = await query('SELECT * FROM qrcodes WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async findByCode(code) {
    const rows = await query('SELECT * FROM qrcodes WHERE code = ? LIMIT 1', [code]);
    return rows[0] || null;
  },

  async codeExists(code) {
    const rows = await query('SELECT COUNT(*) AS total FROM qrcodes WHERE code = ?', [code]);
    return Number(rows[0].total) > 0;
  },

  /**
   * Lista paginada com busca textual e filtro de status.
   */
  async findAll({ search = '', status = 'todos', sort = 'created_at', direction = 'desc', limit = 15, offset = 0 } = {}) {
    const where = [];
    const params = [];

    if (search) {
      where.push('(title LIKE ? OR code LIKE ? OR target_url LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (status === 'ativos') where.push('active = 1');
    if (status === 'inativos') where.push('active = 0');

    const orderColumn = SORTABLE[sort] || SORTABLE.created_at;
    const orderDirection = String(direction).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query(
      `SELECT * FROM qrcodes ${whereClause}
       ORDER BY ${orderColumn} ${orderDirection}
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return rows;
  },

  async countAll({ search = '', status = 'todos' } = {}) {
    const where = [];
    const params = [];

    if (search) {
      where.push('(title LIKE ? OR code LIKE ? OR target_url LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (status === 'ativos') where.push('active = 1');
    if (status === 'inativos') where.push('active = 0');

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(`SELECT COUNT(*) AS total FROM qrcodes ${whereClause}`, params);
    return Number(rows[0].total);
  },

  async update(id, { type, title, description, targetUrl, pixKey, pixKeyKind, pixName, pixCity, pixPayload, color, sizeCm }) {
    await query(
      `UPDATE qrcodes
          SET type = ?, title = ?, description = ?, target_url = ?,
              pix_key = ?, pix_key_kind = ?, pix_name = ?, pix_city = ?, pix_payload = ?,
              color = ?, size_cm = ?
        WHERE id = ?`,
      [type, title, description, targetUrl, pixKey, pixKeyKind, pixName, pixCity, pixPayload, color, sizeCm, id]
    );
  },

  async setActive(id, active) {
    await query('UPDATE qrcodes SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
  },

  async remove(id) {
    await query('DELETE FROM qrcodes WHERE id = ?', [id]);
  },

  /**
   * Registra uma leitura. Incremento atomico direto no banco.
   */
  async registerClick(id) {
    await query('UPDATE qrcodes SET clicks = clicks + 1, last_click_at = NOW() WHERE id = ?', [id]);
  },

  async stats() {
    const rows = await query(
      `SELECT
         COUNT(*)                                  AS total,
         SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS ativos,
         SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) AS inativos,
         COALESCE(SUM(clicks), 0)                   AS cliques,
         SUM(CASE WHEN clicks > 0 THEN 1 ELSE 0 END) AS comLeitura
       FROM qrcodes`
    );
    const row = rows[0] || {};
    return {
      total: Number(row.total || 0),
      ativos: Number(row.ativos || 0),
      inativos: Number(row.inativos || 0),
      cliques: Number(row.cliques || 0),
      comLeitura: Number(row.comLeitura || 0)
    };
  },

  async topByClicks(limit = 5) {
    return query(
      'SELECT * FROM qrcodes ORDER BY clicks DESC, created_at DESC LIMIT ?',
      [Number(limit)]
    );
  },

  async latest(limit = 5) {
    return query('SELECT * FROM qrcodes ORDER BY created_at DESC LIMIT ?', [Number(limit)]);
  }
};

module.exports = QrCode;
