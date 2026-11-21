'use strict';

const env = require('./src/config/env');
const { testConnection, closePool } = require('./src/config/database');
const { store } = require('./src/config/session');
const app = require('./src/app');

async function bootstrap() {
  try {
    await testConnection();
    console.log(`[banco] conectado em ${env.db.host}:${env.db.port}/${env.db.database}`);
  } catch (error) {
    console.error('[banco] nao foi possivel conectar. Confira as credenciais no arquivo .env');
    console.error(`        ${error.message}`);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`[app] ${env.appName} rodando em http://localhost:${env.port} (${env.env})`);
    console.log(`[app] URL publica configurada: ${env.appUrl}`);
    console.log(`[app] QR Codes apontam para: ${env.appUrl}/r/CODIGO`);
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  const shutdown = (signal) => {
    console.log(`\n[app] recebido ${signal}, encerrando com seguranca...`);

    server.close(async () => {
      try {
        await closePool();
        await new Promise((resolve) => store.close(resolve));
      } catch (error) {
        console.error('[app] erro ao encerrar recursos:', error.message);
      } finally {
        process.exit(0);
      }
    });

    // Nao deixa o processo pendurado se alguma conexao travar.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  ['SIGTERM', 'SIGINT'].forEach((signal) => process.on(signal, () => shutdown(signal)));

  process.on('unhandledRejection', (reason) => {
    console.error('[app] promise rejeitada sem tratamento:', reason);
  });
}

bootstrap();
