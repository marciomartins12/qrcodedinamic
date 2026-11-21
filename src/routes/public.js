'use strict';

const express = require('express');
const redirectController = require('../controllers/redirectController');

const router = express.Router();

/** Pagina publica inicial. */
router.get('/', redirectController.home);

/** URL que vai dentro do QR Code. */
router.get('/r/:code', redirectController.scan);

/** Health check usado pelo PM2 / monitoramento da VPS. */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});

module.exports = router;
