'use strict';

const path = require('path');
const { create } = require('express-handlebars');
const helpers = require('../helpers');

/**
 * Configuracao do motor de templates Handlebars.
 * Layouts: src/views/layouts  |  Partials: src/views/partials
 */
module.exports = function registerViewEngine(app) {
  const hbs = create({
    extname: '.handlebars',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, '..', 'views', 'layouts'),
    partialsDir: path.join(__dirname, '..', 'views', 'partials'),
    helpers,
    compilerOptions: {
      // Permite acessar metodos de objetos enviados ao template (ex: Date).
      noEscape: false
    }
  });

  app.engine('.handlebars', hbs.engine);
  app.set('view engine', '.handlebars');
  app.set('views', path.join(__dirname, '..', 'views'));
};
