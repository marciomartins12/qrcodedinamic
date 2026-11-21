'use strict';

const QrCode = require('../models/QrCode');

const redirectController = {
  /** GET / — pagina publica neutra */
  home(req, res) {
    res.render('public/home', {
      layout: 'main',
      pageTitle: 'Plaquinhas QR'
    });
  },

  /**
   * GET /r/:code — coracao do sistema.
   * Conta o clique e envia o visitante para o destino configurado.
   */
  async scan(req, res, next) {
    const code = String(req.params.code || '').trim().toUpperCase();

    try {
      const qrcode = await QrCode.findByCode(code);

      if (!qrcode) {
        return res.status(404).render('public/unavailable', {
          layout: 'main',
          pageTitle: 'QR Code nao encontrado',
          title: 'QR Code nao encontrado',
          message: 'Esta plaquinha nao esta cadastrada no sistema. Verifique o codigo e tente novamente.'
        });
      }

      if (!Number(qrcode.active)) {
        return res.status(410).render('public/unavailable', {
          layout: 'main',
          pageTitle: 'QR Code indisponivel',
          title: 'QR Code temporariamente indisponivel',
          message: 'Esta plaquinha esta pausada no momento. Tente novamente mais tarde.'
        });
      }

      // Contabiliza a leitura sem impedir o redirecionamento.
      try {
        await QrCode.registerClick(qrcode.id);
      } catch (clickError) {
        console.error(`[aviso] falha ao contabilizar leitura do codigo ${code}:`, clickError.message);
      }

      // 302: redirect temporario, evita cache permanente no celular do cliente.
      res.set('Cache-Control', 'no-store');
      return res.redirect(302, qrcode.target_url);
    } catch (error) {
      return next(error);
    }
  }
};

module.exports = redirectController;
