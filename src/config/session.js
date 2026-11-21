'use strict';

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const env = require('./env');

/**
 * As sessoes ficam gravadas no proprio MySQL (tabela `sessions`, criada
 * automaticamente). Vantagem: reiniciar o PM2 nao desloga ninguem.
 */
const store = new MySQLStore({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: 4,
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
});

// Sem isso um erro de conexao no store derrubaria o processo sem log claro.
store.on('error', (error) => {
  console.error('[sessao] erro na tabela de sessoes:', error.message);
});

store.onReady(() => {
  console.log('[sessao] tabela de sessoes pronta no MySQL');
});

function buildSessionMiddleware() {
  return session({
    name: env.session.name,
    secret: env.session.secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      // sameSite lax ja bloqueia CSRF em requisicoes POST de outros sites.
      sameSite: 'lax',
      secure: env.isProduction, // exige HTTPS em producao
      maxAge: env.session.maxAgeMs
    }
  });
}

module.exports = { buildSessionMiddleware, store };
