'use strict';

const QrCode = require('../models/QrCode');
const User = require('../models/User');
const authService = require('../services/authService');

const dashboardController = {
  /** GET /admin */
  async index(req, res, next) {
    try {
      const [stats, latest, top] = await Promise.all([
        QrCode.stats(),
        QrCode.latest(5),
        QrCode.topByClicks(5)
      ]);

      return res.render('admin/dashboard', {
        layout: 'admin',
        pageTitle: 'Visao geral',
        stats,
        latest,
        top
      });
    } catch (error) {
      return next(error);
    }
  },

  /** GET /admin/conta */
  accountForm(req, res) {
    res.render('admin/account', {
      layout: 'admin',
      pageTitle: 'Minha conta',
      form: { name: req.currentUser.name, email: req.currentUser.email }
    });
  },

  /** POST /admin/conta */
  async updateAccount(req, res, next) {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const currentPassword = String(req.body.current_password || '');
    const newPassword = String(req.body.new_password || '');
    const confirmPassword = String(req.body.confirm_password || '');

    const renderWithError = (message) => res.status(422).render('admin/account', {
      layout: 'admin',
      pageTitle: 'Minha conta',
      form: { name, email }
    });

    try {
      if (name.length < 2) {
        req.flash('error', 'Informe um nome valido.');
        return renderWithError('Informe um nome valido.');
      }

      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        req.flash('error', 'Informe um e-mail valido.');
        return renderWithError('Informe um e-mail valido.');
      }

      // Alterar e-mail ou senha exige a senha atual.
      const wantsCredentialChange = email !== req.currentUser.email || newPassword || confirmPassword;

      if (wantsCredentialChange) {
        const passwordOk = await authService.comparePassword(currentPassword, req.currentUser.password_hash);
        if (!passwordOk) {
          req.flash('error', 'A senha atual esta incorreta.');
          return renderWithError('A senha atual esta incorreta.');
        }
      }

      if (newPassword) {
        if (newPassword.length < 8) {
          req.flash('error', 'A nova senha precisa ter no minimo 8 caracteres.');
          return renderWithError('A nova senha precisa ter no minimo 8 caracteres.');
        }
        if (newPassword !== confirmPassword) {
          req.flash('error', 'A confirmacao da nova senha nao confere.');
          return renderWithError('A confirmacao da nova senha nao confere.');
        }
      }

      await User.updateProfile(req.currentUser.id, { name, email });

      if (newPassword) {
        const hash = await authService.hashPassword(newPassword);
        await User.updatePassword(req.currentUser.id, hash);
      }

      req.flash('success', 'Dados da conta atualizados.');
      return res.redirect('/admin/conta');
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        req.flash('error', 'Este e-mail ja esta em uso por outro usuario.');
        return renderWithError('Este e-mail ja esta em uso por outro usuario.');
      }
      return next(error);
    }
  }
};

module.exports = dashboardController;
