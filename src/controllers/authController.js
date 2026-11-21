'use strict';

const authService = require('../services/authService');
const User = require('../models/User');
const env = require('../config/env');

const authController = {
  /** GET /admin/login */
  showLogin(req, res) {
    res.render('auth/login', {
      layout: 'main',
      pageTitle: 'Entrar',
      email: ''
    });
  },

  /** POST /admin/login */
  async login(req, res, next) {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    try {
      if (!email || !password) {
        req.flash('error', 'Preencha o e-mail e a senha.');
        return res.redirect('/admin/login');
      }

      const user = await authService.authenticate(email, password);

      if (!user) {
        // Mensagem generica de proposito: nao revela se o e-mail existe.
        req.flash('error', 'E-mail ou senha incorretos.');
        return res.redirect('/admin/login');
      }

      // Evita fixacao de sessao: renova o identificador apos o login.
      return req.session.regenerate((error) => {
        if (error) return next(error);

        req.session.userId = user.id;
        req.session.flash = [{ type: 'success', message: `Bem-vindo, ${user.name.split(' ')[0]}!` }];

        return req.session.save(async (saveError) => {
          if (saveError) return next(saveError);
          await User.registerLogin(user.id);
          return res.redirect('/admin');
        });
      });
    } catch (error) {
      return next(error);
    }
  },

  /** POST /admin/logout */
  logout(req, res) {
    req.session.destroy(() => {
      res.clearCookie(env.session.name);
      res.redirect('/admin/login');
    });
  }
};

module.exports = authController;
