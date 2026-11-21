'use strict';

const crypto = require('crypto');
const QRCode = require('qrcode');
const env = require('../config/env');
const QrCode = require('../models/QrCode');

// Alfabeto sem caracteres ambiguos (0/O, 1/I/L) para facilitar a digitacao manual.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 7;
const DPI_IMPRESSAO = 300;

const qrService = {
  /**
   * Gera um codigo curto e garante que ele nao existe no banco.
   */
  async generateUniqueCode() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = Array.from({ length: CODE_LENGTH }, () =>
        ALPHABET[crypto.randomInt(0, ALPHABET.length)]
      ).join('');

      if (!(await QrCode.codeExists(code))) return code;
    }

    throw new Error('Nao foi possivel gerar um codigo unico. Tente novamente.');
  },

  /**
   * URL publica que o QR Code carrega (o que o celular abre ao escanear).
   */
  buildScanUrl(code) {
    return `${env.appUrl}/r/${code}`;
  },

  /**
   * Normaliza o link de destino: adiciona https:// quando o usuario
   * digita apenas "site.com.br".
   */
  normalizeUrl(rawUrl) {
    const value = String(rawUrl == null ? '' : rawUrl).trim();
    if (!value) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return value;
    return `https://${value}`;
  },

  /**
   * Aceita apenas http/https/mailto/tel. Bloqueia javascript:, data: etc.
   */
  isValidUrl(url) {
    const value = String(url || '').trim();
    if (!value) return false;

    try {
      const parsed = new URL(value);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
    } catch (error) {
      return false;
    }
  },

  isValidColor(color) {
    return /^#[0-9a-fA-F]{6}$/.test(String(color || ''));
  },

  /**
   * Luminancia relativa (0 = preto, 1 = branco). Usada para avisar o
   * usuario quando a cor escolhida e clara demais para ser lida.
   */
  luminance(color) {
    const hex = String(color).replace('#', '');
    if (hex.length !== 6) return 0;

    const channels = [0, 2, 4].map((index) => {
      const value = parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  },

  isColorReadable(color) {
    return this.luminance(color) < 0.5;
  },

  /**
   * Largura em pixels para impressao nitida: tamanho(cm) na resolucao de 300dpi.
   */
  pixelWidthForSize(sizeCm, dpi = DPI_IMPRESSAO) {
    const cm = Number(sizeCm) || env.qr.defaultSizeCm;
    const width = Math.round((cm / 2.54) * dpi);
    return Math.min(Math.max(width, 200), 3000);
  },

  /**
   * Gera o PNG do QR Code em memoria.
   */
  async renderPng({ text, color, sizeCm, widthPx }) {
    const dark = this.isValidColor(color) ? color : env.qr.defaultColor;
    const width = Number(widthPx) || this.pixelWidthForSize(sizeCm);

    return QRCode.toBuffer(text, {
      type: 'png',
      width,
      margin: env.qr.margin,
      errorCorrectionLevel: env.qr.errorCorrectionLevel,
      color: {
        dark,
        light: '#FFFFFFFF'
      }
    });
  },

  /**
   * Valida os dados vindos do formulario.
   * Retorna { valid, errors, data }.
   */
  validatePayload(payload) {
    const errors = [];

    const title = String(payload.title || '').trim();
    const description = String(payload.description || '').trim();
    const targetUrl = this.normalizeUrl(payload.targetUrl);
    const color = this.isValidColor(payload.color) ? String(payload.color) : env.qr.defaultColor;
    const sizeCm = Number(String(payload.sizeCm || '').replace(',', '.'));
    const active = payload.active === '1' || payload.active === 1 || payload.active === true;

    if (title.length < 2) errors.push('Informe um nome com pelo menos 2 caracteres.');
    if (title.length > 150) errors.push('O nome pode ter no maximo 150 caracteres.');
    if (description.length > 255) errors.push('A descricao pode ter no maximo 255 caracteres.');

    // O destino e opcional: voce pode criar e imprimir a placa primeiro e
    // decidir para onde ela leva depois, editando o QR Code.
    if (targetUrl && !this.isValidUrl(targetUrl)) {
      errors.push('Link invalido. Use enderecos http://, https://, mailto: ou tel:.');
    }

    if (!Number.isFinite(sizeCm) || sizeCm < 1 || sizeCm > 30) {
      errors.push('O tamanho deve ficar entre 1 cm e 30 cm.');
    }

    if (!this.isValidColor(payload.color)) {
      errors.push('Cor invalida. Use o formato hexadecimal, por exemplo #1E3A8A.');
    }

    return {
      valid: errors.length === 0,
      errors,
      data: {
        title,
        description: description || null,
        targetUrl: targetUrl || null,
        color,
        sizeCm: Number.isFinite(sizeCm) ? sizeCm : env.qr.defaultSizeCm,
        active
      }
    };
  }
};

module.exports = qrService;
