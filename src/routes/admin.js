'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');
const qrController = require('../controllers/qrController');
const { requireAuth, redirectIfAuthenticated } = require('../middlewares/auth');

const router = express.Router();

/**
 * Freia ataques de forca bruta na tela de login.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(req, res) {
    req.flash('error', 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.');
    res.status(429).redirect('/admin/login');
  }
});

// ---------------------------------------------------------------------------
// Rotas publicas do painel
// ---------------------------------------------------------------------------
router.get('/login', redirectIfAuthenticated, authController.showLogin);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);

// ---------------------------------------------------------------------------
// A partir daqui tudo exige sessao autenticada
// ---------------------------------------------------------------------------
router.use(requireAuth);

router.get('/', dashboardController.index);

router.get('/conta', dashboardController.accountForm);
router.post('/conta', dashboardController.updateAccount);

router.get('/qrcodes', qrController.index);

// Precisa vir antes de "/qrcodes/:id" para nao ser capturada como id.
router.get('/qrcodes/preview.png', qrController.previewPng);
router.get('/qrcodes/novo', qrController.createForm);
router.post('/qrcodes', qrController.create);

router.get('/qrcodes/:id', qrController.show);
router.get('/qrcodes/:id/editar', qrController.editForm);
router.post('/qrcodes/:id', qrController.update);
router.post('/qrcodes/:id/status', qrController.toggleStatus);
router.post('/qrcodes/:id/excluir', qrController.destroy);

router.get('/qrcodes/:id/qrcode.png', qrController.inlinePng);
router.get('/qrcodes/:id/download.png', qrController.downloadPng);
router.get('/qrcodes/:id/imprimir', qrController.printView);

module.exports = router;
