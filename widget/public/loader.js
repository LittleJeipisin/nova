(function () {
  'use strict';

  /*
   * Evita cargar Nova dos veces
   * accidentalmente en la misma página.
   */
  if (window.__NOVA_WIDGET_LOADED__) {
    return;
  }

  window.__NOVA_WIDGET_LOADED__ = true;

  const script =
    document.currentScript;

  if (!script) {
    console.error(
      '[Nova] No se pudo determinar el script actual.',
    );

    return;
  }

  /*
   * Configuración:
   *
   * data-workspace="..."
   * data-site="..."
   */
  const workspace =
    script.dataset.workspace
      ?.trim();

  const site =
    script.dataset.site
      ?.trim();

  if (!workspace) {
    console.error(
      '[Nova] Falta data-workspace.',
    );

    return;
  }

  if (!site) {
    console.error(
      '[Nova] Falta data-site.',
    );

    return;
  }

  /*
   * Detectamos automáticamente el
   * origen desde donde fue servido
   * loader.js.
   *
   * Desarrollo:
   * http://localhost:5174
   *
   * Producción:
   * https://widget.nova.cl
   */
  const scriptUrl =
    new URL(
      script.src,
      window.location.href,
    );

  const widgetOrigin =
    scriptUrl.origin;

  /*
   * Construimos la URL del iframe.
   */
  const widgetUrl =
    new URL(
      './',
      scriptUrl,
    );

  widgetUrl.searchParams.set(
    'workspace',
    workspace,
  );

  widgetUrl.searchParams.set(
    'site',
    site,
  );

  widgetUrl.searchParams.set(
    'embedded',
    '1',
  );

  /*
   * Creamos iframe.
   */
  const iframe =
    document.createElement(
      'iframe',
    );

  iframe.src =
    widgetUrl.toString();

  iframe.title =
    'Chat de soporte Nova';

  iframe.setAttribute(
    'aria-label',
    'Chat de soporte Nova',
  );

  iframe.setAttribute(
    'allow',
    'clipboard-write',
  );

  iframe.setAttribute(
    'scrolling',
    'no',
  );

  /*
   * Estilos base del iframe.
   */
  iframe.style.position =
    'fixed';

  iframe.style.right =
    '0';

  iframe.style.bottom =
    '0';

  /*
   * Estado cerrado:
   * solamente dejamos espacio
   * suficiente para el launcher.
   */
  iframe.style.width =
    '112px';

  iframe.style.height =
    '112px';

  iframe.style.border =
    '0';

  iframe.style.margin =
    '0';

  iframe.style.padding =
    '0';

  iframe.style.background =
    'transparent';

  iframe.style.zIndex =
    '2147483000';

  iframe.style.overflow =
    'hidden';

  iframe.style.display =
    'block';

  iframe.style.colorScheme =
    'normal';

  iframe.style.transition = [
    'width 160ms ease',
    'height 160ms ease',
  ].join(', ');

  /*
   * Estado informado por React.
   */
  let isOpen =
    false;

  let position =
    'RIGHT';

  /*
   * El breakpoint debe coincidir
   * con App.css.
   */
  function isMobile() {
    return (
      window.innerWidth <=
      520
    );
  }

  /*
   * Posición LEFT / RIGHT.
   */
  function applyPosition() {
    if (
      position ===
      'LEFT'
    ) {
      iframe.style.left =
        '0';

      iframe.style.right =
        'auto';
    } else {
      iframe.style.right =
        '0';

      iframe.style.left =
        'auto';
    }
  }

  /*
   * Ajustamos el tamaño físico
   * del iframe.
   *
   * IMPORTANTE:
   *
   * Desktop abierto = 521px.
   *
   * Debe ser MAYOR que el breakpoint
   * CSS de 520px para evitar que el
   * contenido del iframe active por
   * error los estilos móviles.
   */
  function applySize() {
    /*
     * MÓVIL ABIERTO
     */
    if (
      isOpen &&
      isMobile()
    ) {
      iframe.style.width =
        '100vw';

      iframe.style.height =
        '100dvh';

      iframe.style.top =
        '0';

      iframe.style.bottom =
        'auto';

      iframe.style.left =
        '0';

      iframe.style.right =
        'auto';

      return;
    }

    /*
     * DESKTOP / CERRADO
     */
    iframe.style.top =
      'auto';

    iframe.style.bottom =
      '0';

    applyPosition();

    if (
      isOpen
    ) {
      /*
       * 521 evita activar:
       *
       * @media (max-width: 520px)
       *
       * dentro del iframe.
       */
      iframe.style.width =
        '521px';

      iframe.style.height =
        '688px';
    } else {
      iframe.style.width =
        '112px';

      iframe.style.height =
        '112px';
    }
  }

  /*
   * Recibimos cambios de estado
   * desde App.tsx.
   */
  function handleMessage(
    event,
  ) {
    /*
     * Solo aceptamos mensajes
     * de nuestro iframe.
     */
    if (
      event.source !==
      iframe.contentWindow
    ) {
      return;
    }

    /*
     * Solo aceptamos mensajes
     * del origen de Nova.
     */
    if (
      event.origin !==
      widgetOrigin
    ) {
      return;
    }

    const data =
      event.data;

    if (
      !data ||
      typeof data !==
        'object'
    ) {
      return;
    }

    if (
      data.source !==
      'nova-widget'
    ) {
      return;
    }

    if (
      data.type !==
      'nova:state'
    ) {
      return;
    }

    /*
     * Posición configurada
     * desde backend.
     */
    if (
      data.position ===
        'LEFT' ||
      data.position ===
        'RIGHT'
    ) {
      position =
        data.position;
    }

    /*
     * Estado abierto/cerrado.
     */
    isOpen =
      data.open ===
      true;

    applySize();
  }

  /*
   * Si cambia el tamaño del navegador
   * recalculamos desktop/móvil.
   */
  function handleResize() {
    applySize();
  }

  window.addEventListener(
    'message',
    handleMessage,
  );

  window.addEventListener(
    'resize',
    handleResize,
  );

  /*
   * Estado inicial.
   */
  applySize();

  /*
   * Inserta Nova al final del body.
   */
  function mount() {
    if (
      document.body.contains(
        iframe,
      )
    ) {
      return;
    }

    document.body.appendChild(
      iframe,
    );
  }

  if (
    document.body
  ) {
    mount();
  } else {
    window.addEventListener(
      'DOMContentLoaded',
      mount,
      {
        once: true,
      },
    );
  }
})();