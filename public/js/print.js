'use strict';

/**
 * Folha de impressao do QR Code.
 */
(function () {
  const button = document.getElementById('print-button');
  if (!button) return;

  button.addEventListener('click', function () {
    window.print();
  });
})();
