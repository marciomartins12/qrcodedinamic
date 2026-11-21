'use strict';

const User = require('../models/User');

/**
 * Carrega o usuario da sessao e o deixa disponivel para as views.
 */
async function attachUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.currentPath = req.path;

  if (!req.session || !req.session.userId) return next();

  try {
    const user = await User.findById(req.session.userId);

    if (!user || !user.active) {
      return req.session.destroy(() => res.redirect('/admin/login'));
    }

    req.currentUser = user;
    res.locals.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Bloqueia o acesso as rotas administrativas.
 */
function requireAuth(req, res, next) {
  if (req.currentUser) return next();

  if (req.xhr || (req.get('accept') || '').includes('application/json')) {
    return res.status(401).json({ error: 'Nao autenticado.' });
  }

  req.flash('error', 'Faca login para continuar.');
  return res.redirect('/admin/login');
}

/**
 * Impede que um usuario logado veja a tela de login novamente.
 */
function redirectIfAuthenticated(req, res, next) {
  if (req.currentUser) return res.redirect('/admin');
  return next();
}

module.exports = { attachUser, requireAuth, redirectIfAuthenticated };
