'use strict';

const env = require('../config/env');

/**
 * Rota nao encontrada.
 */
function notFound(req, res) {
  res.status(404).render('errors/404', {
    layout: 'main',
    pageTitle: 'Pagina nao encontrada'
  });
}

/**
 * Tratador central de erros (precisa dos 4 argumentos para o Express).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error(`[erro] ${req.method} ${req.originalUrl} ->`, error);
  }

  if (res.headersSent) return;

  res.status(status).render('errors/500', {
    layout: 'main',
    pageTitle: 'Erro interno',
    status,
    message: env.isProduction ? null : error.message
  });
}

module.exports = { notFound, errorHandler };
