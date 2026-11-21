'use strict';

/**
 * Helpers disponiveis em todos os templates Handlebars.
 */
function pad(value) {
  return String(value).padStart(2, '0');
}

/** Corta um texto e adiciona reticencias (funcao pura, reutilizada abaixo). */
function truncateText(value, length = 42) {
  const text = String(value == null ? '' : value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

module.exports = {
  /** "2026-11-22 14:05:00" -> "22/11/2026 14:05" */
  formatDateTime(value) {
    if (!value) return '—';
    const raw = String(value).replace('T', ' ').slice(0, 19);
    const [date, time = '00:00:00'] = raw.split(' ');
    const [year, month, day] = date.split('-');
    if (!year || !month || !day) return raw;

    const [hour, minute] = time.split(':');
    return `${day}/${month}/${year} ${pad(hour)}:${pad(minute)}`;
  },

  /** "2026-11-22 14:05:00" -> "22/11/2026" */
  formatDate(value) {
    if (!value) return '—';
    const [date] = String(value).replace('T', ' ').split(' ');
    const [year, month, day] = date.split('-');
    if (!year || !month || !day) return date;
    return `${day}/${month}/${year}`;
  },

  /** 12345 -> "12.345" */
  formatNumber(value) {
    const number = Number(value || 0);
    return number.toLocaleString('pt-BR');
  },

  /** 5 -> "5 cm" (sem ",00" desnecessario) */
  formatSize(value) {
    const number = Number(value || 0);
    return `${Number.isInteger(number) ? number : number.toFixed(2).replace('.', ',')} cm`;
  },

  ne(a, b) {
    return String(a) !== String(b);
  },

  gt(a, b) {
    return Number(a) > Number(b);
  },

  or(...args) {
    return args.slice(0, -1).some(Boolean);
  },

  /** Corta textos longos mantendo o layout alinhado. */
  truncate(value, length = 42) {
    return truncateText(value, length);
  },

  /** Esconde o dominio de links muito compridos, mantendo o inicio legivel. */
  shortUrl(value, length = 46) {
    return truncateText(value, length);
  },

  /** "Maria Silva" -> "MS" (usado no avatar) */
  initials(value) {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  },

  /** Comparacao "a === b ? x : y" */
  ifEq(a, b, options) {
    return String(a) === String(b) ? options.fn(this) : options.inverse(this);
  },

  /** Marca o item de menu ativo. */
  isActive(currentPath, target, options) {
    if (!currentPath) return options.inverse(this);
    const active = target === '/admin'
      ? currentPath === '/admin' || currentPath === '/admin/'
      : currentPath.startsWith(target);
    return active ? options.fn(this) : options.inverse(this);
  }
};
