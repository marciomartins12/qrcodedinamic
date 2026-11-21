'use strict';

const env = require('../config/env');
const QrCode = require('../models/QrCode');
const qrService = require('../services/qrService');

const PER_PAGE = 15;

/**
 * Monta os metadados de paginacao para a view.
 */
function buildPagination(total, page) {
  const totalPages = Math.max(Math.ceil(total / PER_PAGE), 1);
  const current = Math.min(Math.max(page, 1), totalPages);
  const windowSize = 2;

  const pages = [];
  const start = Math.max(1, current - windowSize);
  const end = Math.min(totalPages, current + windowSize);

  for (let number = start; number <= end; number += 1) {
    pages.push({ number, active: number === current });
  }

  return {
    total,
    page: current,
    perPage: PER_PAGE,
    totalPages,
    pages,
    hasPrev: current > 1,
    hasNext: current < totalPages,
    pagePrev: current - 1,
    pageNext: current + 1,
    first: total === 0 ? 0 : (current - 1) * PER_PAGE + 1,
    last: Math.min(current * PER_PAGE, total)
  };
}

/**
 * Mantem os filtros ativos ao trocar de pagina.
 */
function buildQuerySuffix(filters) {
  const params = new URLSearchParams();

  if (filters.search) params.set('q', filters.search);
  if (filters.status !== 'todos') params.set('status', filters.status);
  if (filters.sort !== 'created_at') params.set('sort', filters.sort);
  if (filters.direction !== 'desc') params.set('dir', filters.direction);

  const query = params.toString();
  return query ? `&${query}` : '';
}

/** Monta o objeto usado pelo formulario (create e edit compartilham a view). */
function buildFormData(body = {}, defaults = {}) {
  return {
    title: body.title !== undefined ? String(body.title) : (defaults.title || ''),
    description: body.description !== undefined ? String(body.description) : (defaults.description || ''),
    targetUrl: body.targetUrl !== undefined ? String(body.targetUrl) : (defaults.target_url || ''),
    color: qrService.isValidColor(body.color) ? String(body.color) : (defaults.color || env.qr.defaultColor),
    sizeCm: body.sizeCm !== undefined && body.sizeCm !== ''
      ? String(body.sizeCm)
      : String(defaults.size_cm || env.qr.defaultSizeCm),
    active: body.active !== undefined
      ? String(body.active) === '1'
      : (defaults.active === undefined ? true : Boolean(Number(defaults.active)))
  };
}

const qrController = {
  /** GET /admin/qrcodes */
  async index(req, res, next) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const search = String(req.query.q || '').trim();
      const status = ['ativos', 'inativos'].includes(req.query.status) ? req.query.status : 'todos';
      const sort = ['created_at', 'title', 'clicks', 'code'].includes(req.query.sort) ? req.query.sort : 'created_at';
      const direction = req.query.dir === 'asc' ? 'asc' : 'desc';

      const filters = { search, status, sort, direction };

      const [total, qrcodes] = await Promise.all([
        QrCode.countAll(filters),
        QrCode.findAll({ ...filters, limit: PER_PAGE, offset: (page - 1) * PER_PAGE })
      ]);

      return res.render('admin/qrcodes/index', {
        layout: 'admin',
        pageTitle: 'QR Codes',
        qrcodes,
        filters: { q: search, status, sort, dir: direction },
        pagination: buildPagination(total, page),
        baseUrl: '/admin/qrcodes',
        querySuffix: buildQuerySuffix(filters)
      });
    } catch (error) {
      return next(error);
    }
  },

  /** GET /admin/qrcodes/novo */
  createForm(req, res) {
    res.render('admin/qrcodes/form', {
      layout: 'admin',
      pageTitle: 'Novo QR Code',
      mode: 'create',
      qrcode: null,
      form: buildFormData(),
      errors: []
    });
  },

  /** POST /admin/qrcodes */
  async create(req, res, next) {
    const validation = qrService.validatePayload(req.body);

    if (!validation.valid) {
      return res.status(422).render('admin/qrcodes/form', {
        layout: 'admin',
        pageTitle: 'Novo QR Code',
        mode: 'create',
        qrcode: null,
        form: buildFormData(req.body),
        errors: validation.errors
      });
    }

    try {
      const code = await qrService.generateUniqueCode();

      const id = await QrCode.create({
        code,
        title: validation.data.title,
        description: validation.data.description,
        targetUrl: validation.data.targetUrl,
        color: validation.data.color,
        sizeCm: validation.data.sizeCm
      });

      if (!validation.data.active) {
        await QrCode.setActive(id, false);
      }

      req.flash('success', `QR Code "${validation.data.title}" criado com sucesso.`);
      return res.redirect(`/admin/qrcodes/${id}`);
    } catch (error) {
      return next(error);
    }
  },

  /** GET /admin/qrcodes/:id */
  async show(req, res, next) {
    try {
      const qrcode = await QrCode.findById(req.params.id);
      if (!qrcode) return next(Object.assign(new Error('QR Code nao encontrado.'), { status: 404 }));

      return res.render('admin/qrcodes/show', {
        layout: 'admin',
        pageTitle: qrcode.title,
        qrcode,
        scanUrl: qrService.buildScanUrl(qrcode.code)
      });
    } catch (error) {
      return next(error);
    }
  },

  /** GET /admin/qrcodes/:id/editar */
  async editForm(req, res, next) {
    try {
      const qrcode = await QrCode.findById(req.params.id);
      if (!qrcode) return next(Object.assign(new Error('QR Code nao encontrado.'), { status: 404 }));

      return res.render('admin/qrcodes/form', {
        layout: 'admin',
        pageTitle: `Editar: ${qrcode.title}`,
        mode: 'edit',
        qrcode,
        form: buildFormData({}, qrcode),
        errors: []
      });
    } catch (error) {
      return next(error);
    }
  },

  /** POST /admin/qrcodes/:id */
  async update(req, res, next) {
    const id = req.params.id;
    let qrcode;

    try {
      qrcode = await QrCode.findById(id);
    } catch (error) {
      return next(error);
    }

    if (!qrcode) return next(Object.assign(new Error('QR Code nao encontrado.'), { status: 404 }));

    const validation = qrService.validatePayload(req.body);

    if (!validation.valid) {
      return res.status(422).render('admin/qrcodes/form', {
        layout: 'admin',
        pageTitle: `Editar: ${qrcode.title}`,
        mode: 'edit',
        qrcode,
        form: buildFormData(req.body, qrcode),
        errors: validation.errors
      });
    }

    try {
      await QrCode.update(id, {
        title: validation.data.title,
        description: validation.data.description,
        targetUrl: validation.data.targetUrl,
        color: validation.data.color,
        sizeCm: validation.data.sizeCm
      });

      await QrCode.setActive(id, validation.data.active);

      req.flash('success', 'QR Code atualizado. As placas ja impressas continuam funcionando.');
      return res.redirect(`/admin/qrcodes/${id}`);
    } catch (error) {
      return next(error);
    }
  },

  /** POST /admin/qrcodes/:id/status */
  async toggleStatus(req, res, next) {
    try {
      const qrcode = await QrCode.findById(req.params.id);
      if (!qrcode) return next(Object.assign(new Error('QR Code nao encontrado.'), { status: 404 }));

      const nextState = !Number(qrcode.active);
      await QrCode.setActive(qrcode.id, nextState);

      req.flash('success', nextState ? 'QR Code ativado.' : 'QR Code pausado.');
      return res.redirect(req.get('referer') || '/admin/qrcodes');
    } catch (error) {
      return next(error);
    }
  },

  /** POST /admin/qrcodes/:id/excluir */
  async destroy(req, res, next) {
    try {
      const qrcode = await QrCode.findById(req.params.id);
      if (!qrcode) return next(Object.assign(new Error('QR Code nao encontrado.'), { status: 404 }));

      await QrCode.remove(qrcode.id);

      req.flash('success', `QR Code "${qrcode.title}" removido.`);
      return res.redirect('/admin/qrcodes');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * GET /admin/qrcodes/preview.png?t=...&c=...&s=...
   * Previa em tempo real usada no formulario (nada e salvo no banco).
   */
  async previewPng(req, res, next) {
    try {
      const text = String(req.query.t || env.appUrl).slice(0, 2048);
      const color = qrService.isValidColor(req.query.c) ? String(req.query.c) : env.qr.defaultColor;
      const sizeCm = Number(req.query.s) || env.qr.defaultSizeCm;

      const buffer = await qrService.renderPng({ text, color, sizeCm, widthPx: 420 });

      res.type('png');
      res.set('Cache-Control', 'no-store');
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  },

  /** GET /admin/qrcodes/:id/qrcode.png — imagem embutida nas telas */
  async inlinePng(req, res, next) {
    try {
      const qrcode = await QrCode.findById(req.params.id);
      if (!qrcode) return next(Object.assign(new Error('QR Code nao encontrado.'), { status: 404 }));

      const widthPx = Math.min(Number(req.query.w) || 520, 2000);
      const buffer = await qrService.renderPng({
        text: qrService.buildScanUrl(qrcode.code),
        color: qrcode.color,
        sizeCm: qrcode.size_cm,
        widthPx
      });

      res.type('png');
      res.set('Cache-Control', 'no-store');
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  },

  /** GET /admin/qrcodes/:id/download.png — arquivo pronto para a grafica */
  async downloadPng(req, res, next) {
    try {
      const qrcode = await QrCode.findById(req.params.id);
      if (!qrcode) return next(Object.assign(new Error('QR Code nao encontrado.'), { status: 404 }));

      const buffer = await qrService.renderPng({
        text: qrService.buildScanUrl(qrcode.code),
        color: qrcode.color,
        sizeCm: qrcode.size_cm
      });

      const filename = `qrcode-${qrcode.code}-${Number(qrcode.size_cm).toFixed(0)}cm.png`;

      res.type('png');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  },

  /** GET /admin/qrcodes/:id/imprimir — folha pronta para impressao */
  async printView(req, res, next) {
    try {
      const qrcode = await QrCode.findById(req.params.id);
      if (!qrcode) return next(Object.assign(new Error('QR Code nao encontrado.'), { status: 404 }));

      return res.render('admin/qrcodes/print', {
        layout: false,
        pageTitle: `Imprimir: ${qrcode.title}`,
        qrcode,
        scanUrl: qrService.buildScanUrl(qrcode.code)
      });
    } catch (error) {
      return next(error);
    }
  }
};

module.exports = qrController;
