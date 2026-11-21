'use strict';

/**
 * Geracao do "Pix Copia e Cola" (BR Code / padrao EMV MPM).
 *
 * O QR Code do Pix NAO pode ser uma URL: o aplicativo do banco le o conteudo
 * do QR e espera encontrar o payload EMV. Se houver uma URL ali, o app abre o
 * navegador em vez de montar o pagamento.
 */

// GUI (Globally Unique Identifier) do arranjo Pix.
const PIX_GUI = 'br.gov.bcb.pix';
// Em cobranca estatica o campo de referencia e sempre "***".
const REFERENCIA_ESTATICA = '***';
const MAX_NOME = 25;   // limite do padrao EMV para "Merchant Name"
const MAX_CIDADE = 15; // limite do padrao EMV para "Merchant City"
const MAX_CHAVE = 77;  // limite do padrao Pix para a chave

/**
 * Monta um campo no formato TLV: ID (2 digitos) + tamanho (2 digitos) + valor.
 */
function tlv(id, value) {
  const text = String(value == null ? '' : value);
  const length = Buffer.byteLength(text, 'utf8');
  if (length > 99) {
    throw new Error(`Campo ${id} com ${length} caracteres (o maximo e 99).`);
  }
  return `${id}${String(length).padStart(2, '0')}${text}`;
}

/**
 * CRC16-CCITT-FALSE (polinomio 0x1021, valor inicial 0xFFFF).
 * Exigido pelo padrao BR Code para o campo 63.
 */
function crc16(payload) {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Limpa o texto para o padrao EMV: sem acentos, maiusculo e so caracteres
 * aceitos. Evita que um nome com acento corrompa o payload.
 */
function sanitizeText(value, maxLength) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

/** Valida os digitos verificadores do CPF. */
function isValidCpf(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const digito = (base) => {
    let soma = 0;
    for (let index = 0; index < base.length; index += 1) {
      soma += Number(base[index]) * (base.length + 1 - index);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(digits.slice(0, 9)) === Number(digits[9])
    && digito(digits.slice(0, 10)) === Number(digits[10]);
}

/** Valida os digitos verificadores do CNPJ. */
function isValidCnpj(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const digito = (base) => {
    const pesos = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let soma = 0;
    for (let index = 0; index < base.length; index += 1) {
      soma += Number(base[index]) * pesos[index];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digito(digits.slice(0, 12)) === Number(digits[12])
    && digito(digits.slice(0, 13)) === Number(digits[13]);
}

const TIPOS = {
  cpf: { rotulo: 'CPF' },
  cnpj: { rotulo: 'CNPJ' },
  email: { rotulo: 'E-mail' },
  telefone: { rotulo: 'Telefone' },
  aleatoria: { rotulo: 'Chave aleatoria' }
};

/**
 * Identifica o tipo da chave e devolve a forma exata que o Pix espera.
 * A deteccao e deliberadamente conservadora: melhor recusar do que gravar
 * uma chave que enviaria o dinheiro para o lugar errado.
 */
function normalizeKey(rawValue) {
  const raw = String(rawValue == null ? '' : rawValue).trim();

  if (!raw) return { valid: false, error: 'Informe a chave Pix.' };
  if (raw.length > MAX_CHAVE) return { valid: false, error: `A chave Pix pode ter no maximo ${MAX_CHAVE} caracteres.` };

  // E-mail
  if (raw.includes('@')) {
    const email = raw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { valid: false, error: 'E-mail invalido. Confira o endereco digitado.' };
    }
    return { valid: true, key: email, kind: 'email' };
  }

  // Chave aleatoria (EVP): UUID v4
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return { valid: true, key: raw.toLowerCase(), kind: 'aleatoria' };
  }

  // Telefone no padrao internacional (+55...)
  if (raw.startsWith('+')) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 12 || digits.length > 15 || !digits.startsWith('55')) {
      return { valid: false, error: 'Telefone invalido. Use o formato +55DDDNUMERO, por exemplo +5511999998888.' };
    }
    return { valid: true, key: `+${digits}`, kind: 'telefone' };
  }

  // Somente digitos (aceitando pontuacao de CPF/CNPJ)
  if (/^[\d.\-/\s]+$/.test(raw)) {
    const digits = raw.replace(/\D/g, '');

    if (digits.length === 11) {
      if (!isValidCpf(digits)) return { valid: false, error: 'CPF invalido. Confira os numeros digitados.' };
      return { valid: true, key: digits, kind: 'cpf' };
    }

    if (digits.length === 14) {
      if (!isValidCnpj(digits)) return { valid: false, error: 'CNPJ invalido. Confira os numeros digitados.' };
      return { valid: true, key: digits, kind: 'cnpj' };
    }

    // Telefone digitado sem o "+"
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      return { valid: true, key: `+${digits}`, kind: 'telefone' };
    }

    return {
      valid: false,
      error: 'Chave invalida. Use CPF (11 digitos), CNPJ (14), telefone (+55DDDNUMERO) ou e-mail.'
    };
  }

  return {
    valid: false,
    error: 'Chave invalida. Use CPF, CNPJ, telefone (+55DDDNUMERO), e-mail ou chave aleatoria (UUID).'
  };
}

/**
 * Monta o payload EMV completo (BR Code estatico).
 */
function buildPayload({ key, name, city }) {
  const nome = sanitizeText(name, MAX_NOME) || 'RECEBEDOR';
  const cidade = sanitizeText(city, MAX_CIDADE) || 'BRASIL';

  const semCrc = tlv('00', '01')
    + tlv('26', tlv('00', PIX_GUI) + tlv('01', key))
    + tlv('52', '0000')
    + tlv('53', '986')      // moeda: BRL
    + tlv('58', 'BR')       // pais
    + tlv('59', nome)
    + tlv('60', cidade)
    + tlv('62', tlv('05', REFERENCIA_ESTATICA))
    + '6304';               // ID e tamanho do proprio CRC

  return semCrc + crc16(semCrc);
}

/**
 * Valida os dados do Pix vindos do formulario.
 * Retorna { valid, errors, data }.
 */
function validatePix({ key, name, city }) {
  const errors = [];
  const chave = normalizeKey(key);

  if (!chave.valid) errors.push(chave.error);

  const nome = sanitizeText(name, MAX_NOME);
  if (!nome) errors.push('Informe o nome do recebedor (quem vai receber o Pix).');

  const cidade = sanitizeText(city, MAX_CIDADE);
  if (!cidade) errors.push('Informe a cidade do recebedor.');

  if (errors.length) return { valid: false, errors, data: null };

  return {
    valid: true,
    errors: [],
    data: {
      key: chave.key,
      keyKind: chave.kind,
      keyLabel: TIPOS[chave.kind].rotulo,
      name: nome,
      city: cidade,
      payload: buildPayload({ key: chave.key, name: nome, city: cidade })
    }
  };
}

/**
 * Rotulo amigavel para o tipo de chave (usado nas telas do painel).
 */
function keyKindLabel(kind) {
  return TIPOS[kind] ? TIPOS[kind].rotulo : 'Chave Pix';
}

module.exports = {
  tlv,
  crc16,
  sanitizeText,
  isValidCpf,
  isValidCnpj,
  normalizeKey,
  buildPayload,
  validatePix,
  keyKindLabel,
  constants: { PIX_GUI, MAX_NOME, MAX_CIDADE, MAX_CHAVE }
};
