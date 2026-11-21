'use strict';

const QrCode = require('../models/QrCode');
const qrService = require('../services/qrService');

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
   * Link: conta o clique e envia o visitante para o destino configurado.
   * Pix : nao existe destino para onde redirecionar, entao mostramos a
   *       pagina com o codigo copia-e-cola.
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

      if (qrcode.type === 'pix') {
        return redirectController.renderPixPage(res, qrcode);
      }

      // Ainda sem link de destino: a placa foi criada/impressa mas o destino
      // sera configurado depois no painel.
      if (!qrcode.target_url) {
        return res.status(503).render('public/unavailable', {
          layout: 'main',
          pageTitle: 'Destino nao configurado',
          title: 'Destino ainda nao configurado',
          message: 'Esta plaquinha ainda nao tem um link de destino. Configure no painel para comecar a redirecionar.'
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
  },

  /**
   * GET /p/:code — pagina publica de um QR Code Pix.
   * Mostra o "Pix copia e cola" e a imagem do QR para quem nao conseguiu
   * ler o codigo com a camera.
   */
  async pixPage(req, res, next) {
    const code = String(req.params.code || '').trim().toUpperCase();

    try {
      const qrcode = await QrCode.findByCode(code);

      if (!qrcode || qrcode.type !== 'pix') {
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

      return redirectController.renderPixPage(res, qrcode);
    } catch (error) {
      return next(error);
    }
  },

  /** Renderiza a pagina publica do Pix (compartilhada por /r/:code e /p/:code). */
  renderPixPage(res, qrcode) {
    // Contabiliza a abertura da pagina sem impedir a renderizacao.
    QrCode.registerClick(qrcode.id).catch((clickError) => {
      console.error(`[aviso] falha ao contabilizar leitura do codigo ${qrcode.code}:`, clickError.message);
    });

    res.set('Cache-Control', 'no-store');
    return res.render('public/pix', {
      layout: 'main',
      pageTitle: qrcode.title,
      qrcode,
      pixPayload: qrcode.pix_payload || '',
      qrImageUrl: `/p/${qrcode.code}/qrcode.png`
    });
  },

  /**
   * GET /p/:code/qrcode.png — imagem publica do QR Code Pix.
   * Necessaria porque as imagens do painel exigem login.
   */
  async pixQrPng(req, res, next) {
    const code = String(req.params.code || '').trim().toUpperCase();

    try {
      const qrcode = await QrCode.findByCode(code);

      if (!qrcode || qrcode.type !== 'pix' || !qrcode.pix_payload) {
        return res.status(404).json({ error: 'QR Code nao encontrado.' });
      }

      const buffer = await qrService.renderPng({
        text: qrcode.pix_payload,
        color: qrcode.color,
        sizeCm: qrcode.size_cm
      });

      res.type('png');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  }
};

module.exports = redirectController;
