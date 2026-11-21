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
  const isServerError = status >= 500;

  if (isServerError) {
    console.error(`[erro ${status}] ${req.method} ${req.originalUrl} ->`, error);
  } else {
    // Erros de cliente tambem precisam ficar registrados. Sem isso um 404 passa
    // silencioso e fica impossivel descobrir a causa olhando o log.
    console.warn(`[aviso ${status}] ${req.method} ${req.originalUrl} -> ${error.message}`);
  }

  if (res.headersSent) return;

  // Usa o template que corresponde ao status: antes todo erro caia em errors/500,
  // entao um simples 404 aparecia como "erro inesperado no servidor".
  return res.status(status).render(isServerError ? 'errors/500' : 'errors/404', {
    layout: 'main',
    pageTitle: isServerError ? 'Erro interno' : 'Pagina nao encontrada',
    status,
    message: env.isProduction ? null : error.message
  });
}

module.exports = { notFound, errorHandler };
