'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

/**
 * Le uma variavel de ambiente obrigatoria, lancando erro caso ausente.
 */
function required(key) {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}. Verifique o arquivo .env`);
  }
  return value;
}

function optional(key, fallback) {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function toNumber(key, fallback) {
  const value = Number(optional(key, fallback));
  return Number.isFinite(value) ? value : Number(fallback);
}

const env = optional('NODE_ENV', 'development');

/** Remove barras finais para evitar URLs com "//". */
function normalizeBaseUrl(url) {
  return String(url).trim().replace(/\/+$/, '');
}

function toBoolean(key, fallback) {
  const value = optional(key, null);
  if (value === null) return fallback;
  return value === 'true' || value === '1';
}

const isProduction = env === 'production';

module.exports = {
  env,
  isProduction,
  // Cookie `secure` so trafega em HTTPS. Em producao sem HTTPS (ex: acesso por
  // IP ou hostname do VPS) defina COOKIE_SECURE=false no .env, senao o login
  // fica em loop porque o navegador nunca envia o cookie de sessao.
  cookieSecure: toBoolean('COOKIE_SECURE', isProduction),
  port: toNumber('PORT', 3000),
  appName: optional('APP_NAME', 'Plaquinhas QR'),
  appUrl: normalizeBaseUrl(optional('APP_URL', `http://localhost:${toNumber('PORT', 3000)}`)),

  session: {
    name: 'plaquinhas.sid',
    secret: required('SESSION_SECRET'),
    maxAgeMs: toNumber('SESSION_MAX_AGE_HOURS', 72) * 60 * 60 * 1000
  },

  db: {
    host: optional('DB_HOST', '127.0.0.1'),
    port: toNumber('DB_PORT', 3306),
    user: optional('DB_USER', 'root'),
    password: optional('DB_PASSWORD', ''),
    database: optional('DB_NAME', 'plaquinhas'),
    connectionLimit: toNumber('DB_CONNECTION_LIMIT', 10)
  },

  // Usado apenas pelo script `npm run db:setup` para criar o primeiro admin.
  admin: {
    name: optional('ADMIN_NAME', 'Administrador'),
    email: optional('ADMIN_EMAIL', ''),
    password: optional('ADMIN_PASSWORD', '')
  },

  qr: {
    defaultSizeCm: toNumber('QR_DEFAULT_SIZE_CM', 5),
    defaultColor: optional('QR_DEFAULT_COLOR', '#000000'),
    errorCorrectionLevel: optional('QR_ERROR_CORRECTION_LEVEL', 'H'),
    margin: toNumber('QR_MARGIN', 2)
  }
};
