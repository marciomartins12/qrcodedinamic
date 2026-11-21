'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const env = require('./config/env');
const registerViewEngine = require('./config/viewEngine');
const { buildSessionMiddleware } = require('./config/session');

const flash = require('./middlewares/flash');
const { attachUser } = require('./middlewares/auth');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const routes = require('./routes');

const app = express();

// A VPS normalmente fica atras de um proxy reverso (nginx).
// Necessario para o Express ler IP real e o header X-Forwarded-Proto.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Seguranca
// ---------------------------------------------------------------------------
const cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  fontSrc: ["'self'", 'https:', 'data:'],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
  imgSrc: ["'self'", 'data:', 'blob:'],
  objectSrc: ["'none'"],
  scriptSrc: ["'self'"],
  scriptSrcAttr: ["'none'"], // bloqueia onclick="" inline — o JS fica em public/js
  styleSrc: ["'self'", 'https:', "'unsafe-inline'"]
};

if (env.isProduction) cspDirectives.upgradeInsecureRequests = [];

app.use(helmet({
  contentSecurityPolicy: { directives: cspDirectives },
  crossOriginEmbedderPolicy: false,
  hsts: env.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false
}));

app.use(compression());

// ---------------------------------------------------------------------------
// Parsers e arquivos estaticos
// ---------------------------------------------------------------------------
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(express.json({ limit: '256kb' }));

app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: env.isProduction ? '7d' : 0,
  etag: true
}));

// ---------------------------------------------------------------------------
// Sessao + usuario logado + mensagens flash
// ---------------------------------------------------------------------------
app.use(buildSessionMiddleware());
app.use(flash);
app.use(attachUser);

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
registerViewEngine(app);

app.use((req, res, next) => {
  res.locals.appName = env.appName;
  res.locals.appUrl = env.appUrl;
  res.locals.environment = env.env;
  res.locals.isProduction = env.isProduction;
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
app.use(routes);

// ---------------------------------------------------------------------------
// 404 e erros
// ---------------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
