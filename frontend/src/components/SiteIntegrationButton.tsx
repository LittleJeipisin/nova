import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  getWorkspaceSlugFromPath,
} from '../lib/workspace-route';

import './SiteIntegrationButton.css';

type SiteIntegrationButtonProps = {
  siteName: string;
  siteSlug: string;

  siteStatus:
    | 'ACTIVE'
    | 'INACTIVE';
};

const configuredWidgetUrl =
  (
    import.meta.env
      .VITE_NOVA_WIDGET_URL as
      | string
      | undefined
  )?.trim() ??
  '';

function getLoaderUrl() {
  const widgetUrl =
    configuredWidgetUrl ||
    'http://localhost:5174';

  const cleanUrl =
    widgetUrl.replace(
      /\/+$/,
      '',
    );

  if (
    cleanUrl.endsWith(
      '/loader.js',
    )
  ) {
    return cleanUrl;
  }

  return `${cleanUrl}/loader.js`;
}

export function SiteIntegrationButton({
  siteName,
  siteSlug,
  siteStatus,
}: SiteIntegrationButtonProps) {
  const [
    open,
    setOpen,
  ] =
    useState(
      false,
    );

  const [
    copied,
    setCopied,
  ] =
    useState(
      false,
    );

  const [
    copyError,
    setCopyError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const copiedTimeoutRef =
    useRef<
      number | null
    >(
      null,
    );

  const workspaceSlug =
    getWorkspaceSlugFromPath() ??
    '';

  const loaderUrl =
    getLoaderUrl();

  const integrationCode =
    [
      '<script',
      `  src="${loaderUrl}"`,
      `  data-workspace="${workspaceSlug}"`,
      `  data-site="${siteSlug}"`,
      '></script>',
    ].join(
      '\n',
    );

  useEffect(
    () => {
      if (
        !open
      ) {
        return;
      }

      function handleKeyDown(
        event:
          KeyboardEvent,
      ) {
        if (
          event.key ===
          'Escape'
        ) {
          setOpen(
            false,
          );
        }
      }

      window.addEventListener(
        'keydown',
        handleKeyDown,
      );

      return () => {
        window.removeEventListener(
          'keydown',
          handleKeyDown,
        );
      };
    },
    [
      open,
    ],
  );

  useEffect(
    () => {
      return () => {
        if (
          copiedTimeoutRef
            .current !==
          null
        ) {
          window.clearTimeout(
            copiedTimeoutRef
              .current,
          );
        }
      };
    },
    [],
  );

  async function handleCopy() {
    if (
      !workspaceSlug
    ) {
      setCopyError(
        'No se pudo determinar el workspace.',
      );

      return;
    }

    try {
      if (
        !navigator.clipboard
      ) {
        throw new Error(
          'Clipboard API no disponible',
        );
      }

      await navigator.clipboard.writeText(
        integrationCode,
      );

      setCopyError(
        null,
      );

      setCopied(
        true,
      );

      if (
        copiedTimeoutRef
          .current !==
        null
      ) {
        window.clearTimeout(
          copiedTimeoutRef
            .current,
        );
      }

      copiedTimeoutRef.current =
        window.setTimeout(
          () => {
            setCopied(
              false,
            );

            copiedTimeoutRef.current =
              null;
          },
          2000,
        );
    } catch (
      error
    ) {
      console.error(
        'No se pudo copiar el código:',
        error,
      );

      setCopyError(
        'No se pudo copiar automáticamente. Puedes seleccionar el código manualmente.',
      );
    }
  }

  return (
    <>
      <button
        type="button"
        className="nova-site-integration-button"
        onClick={() => {
          setOpen(
            true,
          );

          setCopied(
            false,
          );

          setCopyError(
            null,
          );
        }}
      >
        <span>
          &lt;/&gt;
        </span>

        Integración
      </button>

      {open ? (
        <div
          className="nova-site-integration-overlay"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(
                false,
              );
            }
          }}
        >
          <section
            className="nova-site-integration-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nova-site-integration-title"
          >
            <header className="nova-site-integration-modal__header">
              <div>
                <span className="nova-site-integration-modal__eyebrow">
                  Widget Nova
                </span>

                <h2 id="nova-site-integration-title">
                  Integrar Nova
                </h2>

                <p>
                  {
                    siteName
                  }
                </p>
              </div>

              <button
                type="button"
                className="nova-site-integration-modal__close"
                aria-label="Cerrar"
                onClick={() => {
                  setOpen(
                    false,
                  );
                }}
              >
                ×
              </button>
            </header>

            <div className="nova-site-integration-modal__body">
              <div className="nova-site-integration-summary">
                <div>
                  <span>
                    Workspace
                  </span>

                  <strong>
                    {workspaceSlug ||
                      'No disponible'}
                  </strong>
                </div>

                <div>
                  <span>
                    Página
                  </span>

                  <strong>
                    {
                      siteSlug
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Estado
                  </span>

                  <strong
                    className={
                      siteStatus ===
                      'ACTIVE'
                        ? 'nova-site-integration-summary__status nova-site-integration-summary__status--active'
                        : 'nova-site-integration-summary__status nova-site-integration-summary__status--inactive'
                    }
                  >
                    {siteStatus ===
                    'ACTIVE'
                      ? 'Activa'
                      : 'Inactiva'}
                  </strong>
                </div>
              </div>

              {siteStatus ===
              'INACTIVE' ? (
                <div className="nova-site-integration-warning">
                  Esta página está inactiva. El código puede instalarse, pero el widget no estará disponible hasta reactivarla.
                </div>
              ) : null}

              <div className="nova-site-integration-instructions">
                <strong>
                  Código de instalación
                </strong>

                <p>
                  Agrega este código antes de la etiqueta{' '}
                  <code>
                    &lt;/body&gt;
                  </code>{' '}
                  de tu sitio web.
                </p>
              </div>

              <div className="nova-site-integration-code">
                <div className="nova-site-integration-code__header">
                  <span>
                    HTML
                  </span>

                  <button
                    type="button"
                    disabled={
                      !workspaceSlug
                    }
                    onClick={() => {
                      void handleCopy();
                    }}
                  >
                    {copied
                      ? '✓ Copiado'
                      : 'Copiar código'}
                  </button>
                </div>

                <pre>
                  <code>
                    {
                      integrationCode
                    }
                  </code>
                </pre>
              </div>

              {copyError ? (
                <div
                  className="nova-site-integration-error"
                  role="alert"
                >
                  {
                    copyError
                  }
                </div>
              ) : null}

              <div className="nova-site-integration-help">
                <div className="nova-site-integration-help__icon">
                  i
                </div>

                <div>
                  <strong>
                    No necesitas modificar el código
                  </strong>

                  <span>
                    Nova ya incluye automáticamente el workspace y la página seleccionada.
                  </span>
                </div>
              </div>
            </div>

            <footer className="nova-site-integration-modal__footer">
              <button
                type="button"
                className="nova-site-integration-modal__cancel"
                onClick={() => {
                  setOpen(
                    false,
                  );
                }}
              >
                Cerrar
              </button>

              <button
                type="button"
                className="nova-site-integration-modal__copy"
                disabled={
                  !workspaceSlug
                }
                onClick={() => {
                  void handleCopy();
                }}
              >
                {copied
                  ? '✓ Código copiado'
                  : 'Copiar código'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}