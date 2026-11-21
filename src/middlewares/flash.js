'use strict';

/**
 * Disponibiliza mensagens de aviso que sobrevivem a um redirect (flash).
 * Uso: req.flash('success', 'Salvo com sucesso')
 */
function flash(req, res, next) {
  req.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = [];
    req.session.flash.push({ type, message });
  };

  res.locals.flash = req.session.flash || [];
  delete req.session.flash;

  next();
}

module.exports = flash;
