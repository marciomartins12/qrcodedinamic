'use strict';

const bcrypt = require('bcryptjs');
const User = require('../models/User');

const SALT_ROUNDS = 10;

/**
 * Regras de autenticacao do painel.
 */
const authService = {
  hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
  },

  comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash);
  },

  /**
   * Valida credenciais. Retorna o usuario ou null.
   * A mensagem de erro e sempre generica para nao revelar se o e-mail existe.
   */
  async authenticate(email, password) {
    const user = await User.findByEmail(String(email).trim().toLowerCase());
    if (!user || !user.active) return null;

    const ok = await this.comparePassword(password, user.password_hash);
    return ok ? user : null;
  }
};

module.exports = authService;
