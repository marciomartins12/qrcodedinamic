'use strict';

/**
 * Script unico do painel. Nada de codigo inline nos templates por causa da CSP.
 */
(function () {
  // -------------------------------------------------------------------------
  // Mensagens flash: botao de fechar
  // -------------------------------------------------------------------------
  document.addEventListener('click', function (event) {
    const dismiss = event.target.closest('[data-dismiss-flash]');
    if (dismiss) {
      const flash = dismiss.closest('.flash');
      if (flash) flash.remove();
    }
  });

  // -------------------------------------------------------------------------
  // Menu lateral no mobile
  // -------------------------------------------------------------------------
  const sidebarToggle = document.querySelector('[data-toggle-sidebar]');
  const sidebar = document.getElementById('sidebar');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', function () {
      sidebar.classList.toggle('is-open');
    });

    document.addEventListener('click', function (event) {
      if (!sidebar.classList.contains('is-open')) return;
      if (sidebar.contains(event.target) || sidebarToggle.contains(event.target)) return;
      sidebar.classList.remove('is-open');
    });
  }

  // -------------------------------------------------------------------------
  // Copiar link para a area de transferencia
  // -------------------------------------------------------------------------
  document.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-copy]');
    if (!button) return;

    const value = button.getAttribute('data-copy') || '';
    const original = button.textContent;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const helper = document.createElement('textarea');
        helper.value = value;
        helper.setAttribute('readonly', '');
        helper.style.position = 'absolute';
        helper.style.left = '-9999px';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }

      button.classList.add('is-copied');
      button.textContent = 'Copiado!';
      setTimeout(function () {
        button.classList.remove('is-copied');
        button.textContent = original;
      }, 1600);
    } catch (error) {
      console.warn('Nao foi possivel copiar automaticamente.', error);
    }
  });

  // -------------------------------------------------------------------------
  // Confirmacao antes de excluir
  // -------------------------------------------------------------------------
  document.addEventListener('submit', function (event) {
    const form = event.target;
    const message = form.getAttribute && form.getAttribute('data-confirm');

    if (message && !window.confirm(message)) {
      event.preventDefault();
    }
  });

  // -------------------------------------------------------------------------
  // Formulario do QR Code: tipo, cor e previa em tempo real
  // -------------------------------------------------------------------------
  const form = document.querySelector('[data-qr-form]');
  if (!form) return;

  const previewImage = form.querySelector('[data-qr-preview]');
  const colorPicker = form.querySelector('[data-color-picker]');
  const colorText = form.querySelector('[data-color-text]');
  const warning = form.querySelector('[data-color-warning]');
  const targetInput = form.querySelector('[id="targetUrl"]');
  const sizeInput = form.querySelector('[data-qr-size]');

  const typeInputs = form.querySelectorAll('input[name="type"]');
  const typeFields = form.querySelectorAll('[data-type-field]');
  const noteLink = form.querySelector('[data-preview-note-link]');
  const notePix = form.querySelector('[data-preview-note-pix]');
  const pixKeyInput = form.querySelector('[id="pixKey"]');
  const pixNameInput = form.querySelector('[id="pixName"]');
  const pixCityInput = form.querySelector('[id="pixCity"]');
  const pixPayloadPreview = form.querySelector('[data-pix-payload-preview]');
  const pixError = form.querySelector('[data-pix-error]');

  const previewUrl = form.getAttribute('data-preview-url') || '/admin/qrcodes/preview.png';
  const pixPreviewUrl = form.getAttribute('data-pix-preview-url') || '/admin/qrcodes/pix-preview.json';
  const scanBase = form.getAttribute('data-scan-base') || '';
  const isValidHex = (value) => /^#[0-9a-fA-F]{6}$/.test(value);

  /** Tipo escolhido no formulario: "link" ou "pix". */
  function currentType() {
    const checked = form.querySelector('input[name="type"]:checked');
    return checked ? checked.value : 'link';
  }

  /**
   * Luminancia relativa: avisa o usuario quando a cor ficaria clara demais
   * para a camera conseguir ler o QR impresso.
   */
  function isTooLight(hex) {
    const value = hex.replace('#', '');
    if (value.length !== 6) return false;

    const channels = [0, 2, 4].map(function (index) {
      const channel = parseInt(value.slice(index, index + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });

    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return luminance >= 0.5;
  }

  let debounceTimer = null;

  function debounce(callback, delay) {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(callback, delay);
  }

  /** Recarrega a imagem da previa com o texto que vai dentro do QR Code. */
  function setPreviewText(text) {
    if (!previewImage) return;

    const color = isValidHex(colorText.value) ? colorText.value : '#000000';
    const size = Number(sizeInput.value) || 5;

    previewImage.src = previewUrl
      + '?t=' + encodeURIComponent(text)
      + '&c=' + encodeURIComponent(color)
      + '&s=' + encodeURIComponent(size);

    if (warning) warning.hidden = !isTooLight(color);
  }

  /** Tipo "link": a previa mostra o link de destino ou a URL curta do sistema. */
  function refreshLinkPreview() {
    const target = (targetInput.value || '').trim();
    setPreviewText(target || (scanBase + 'CODIGO'));
  }

  /**
   * Tipo "pix": o BR Code precisa ser montado no servidor (CRC16 e validacao
   * das chaves), entao pedimos o codigo pronto e usamos como texto do QR.
   */
  async function refreshPixPreview() {
    const params = new URLSearchParams({
      key: pixKeyInput ? pixKeyInput.value : '',
      name: pixNameInput ? pixNameInput.value : '',
      city: pixCityInput ? pixCityInput.value : ''
    });

    try {
      const response = await fetch(pixPreviewUrl + '?' + params.toString(), {
        credentials: 'same-origin'
      });
      const result = await response.json();

      if (result.valid) {
        if (pixPayloadPreview) pixPayloadPreview.value = result.payload;
        if (pixError) {
          pixError.hidden = true;
          pixError.textContent = '';
        }
        setPreviewText(result.payload);
      } else {
        if (pixPayloadPreview) pixPayloadPreview.value = '';
        if (pixError) {
          pixError.hidden = false;
          pixError.textContent = (result.errors && result.errors[0]) || 'Preencha os dados do Pix.';
        }
        setPreviewText('PIX');
      }
    } catch (error) {
      console.warn('Nao foi possivel gerar a previa do Pix.', error);
    }
  }

  function refreshPreview() {
    if (currentType() === 'pix') {
      refreshPixPreview();
    } else {
      refreshLinkPreview();
    }
  }

  /** Mostra somente os campos do tipo escolhido. */
  function applyType() {
    const type = currentType();

    typeFields.forEach(function (field) {
      field.hidden = field.getAttribute('data-type-field') !== type;
    });

    if (noteLink) noteLink.hidden = type === 'pix';
    if (notePix) notePix.hidden = type !== 'pix';

    refreshPreview();
  }

  if (colorPicker && colorText) {
    colorPicker.addEventListener('input', function () {
      colorText.value = colorPicker.value.toUpperCase();
      debounce(refreshPreview, 220);
    });

    colorText.addEventListener('input', function () {
      const value = colorText.value.trim();
      if (isValidHex(value)) {
        colorPicker.value = value;
        debounce(refreshPreview, 220);
      } else if (warning) {
        warning.hidden = true;
      }
    });
  }

  if (sizeInput) {
    ['input', 'change'].forEach(function (eventName) {
      sizeInput.addEventListener(eventName, function () {
        debounce(refreshPreview, 220);
      });
    });
  }

  if (targetInput) {
    ['input', 'change'].forEach(function (eventName) {
      targetInput.addEventListener(eventName, function () {
        debounce(refreshLinkPreview, 220);
      });
    });
  }

  typeInputs.forEach(function (input) {
    input.addEventListener('change', applyType);
  });

  [pixKeyInput, pixNameInput, pixCityInput].forEach(function (input) {
    if (!input) return;
    input.addEventListener('input', function () {
      debounce(refreshPixPreview, 320);
    });
  });

  applyType();
})();

