import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  ChangeEvent,
  SyntheticEvent,
} from 'react';

import './App.css';

import {
  connectNovaSocket,
  getNovaConfig,
  getNovaMessages,
  getNovaSession,
  NOVA_API_URL,
  resetNovaSessionCache,
  restoreNovaSession,
  sendNovaImageMessage,
  sendNovaTextMessage,
} from './nova';

import type {
  NovaMessage,
  NovaSession,
  NovaWidgetConfig,
} from './nova';

function formatMessageTime(
  createdAt:
    string,
) {
  return new Intl.DateTimeFormat(
    'es-CL',
    {
      hour:
        '2-digit',

      minute:
        '2-digit',

      hour12:
        false,
    },
  ).format(
    new Date(
      createdAt,
    ),
  );
}

function sortMessages(
  messages:
    NovaMessage[],
) {
  return [
    ...messages,
  ].sort(
    (
      a,
      b,
    ) =>
      new Date(
        a.createdAt,
      ).getTime() -
      new Date(
        b.createdAt,
      ).getTime(),
  );
}

function App() {
  const [
    config,
    setConfig,
  ] =
    useState<
      NovaWidgetConfig | null
    >(
      null,
    );

  const [
    configError,
    setConfigError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    isOpen,
    setIsOpen,
  ] =
    useState(
      false,
    );

  const [
    connectionStatus,
    setConnectionStatus,
  ] =
    useState(
      'Disponible',
    );

  const [
    session,
    setSession,
  ] =
    useState<
      NovaSession | null
    >(
      null,
    );

  const [
    initializingSession,
    setInitializingSession,
  ] =
    useState(
      false,
    );

  const [
    messages,
    setMessages,
  ] =
    useState<
      NovaMessage[]
    >([]);

  const [
    input,
    setInput,
  ] =
    useState('');

  const [
    sending,
    setSending,
  ] =
    useState(
      false,
    );

  const [
    selectedImage,
    setSelectedImage,
  ] =
    useState<
      File | null
    >(
      null,
    );

  const [
    imagePreview,
    setImagePreview,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const messagesEndRef =
    useRef<
      HTMLDivElement | null
    >(
      null,
    );

  const fileInputRef =
    useRef<
      HTMLInputElement | null
    >(
      null,
    );

  const socketRef =
    useRef<
      ReturnType<
        typeof connectNovaSocket
      > | null
    >(
      null,
    );

  const initializingRef =
    useRef(
      false,
    );

  /*
   * Evita que nuestro disconnect()
   * intencional al cerrar la conversación
   * cambie "Finalizada" por
   * "Desconectado".
   */
  const conversationClosedRef =
    useRef(
      false,
    );

  const addMessage =
    useCallback(
      (
        message:
          NovaMessage,
      ) => {
        setMessages(
          (
            currentMessages,
          ) => {
            const alreadyExists =
              currentMessages.some(
                (
                  currentMessage,
                ) =>
                  currentMessage.id ===
                  message.id,
              );

            if (
              alreadyExists
            ) {
              return currentMessages;
            }

            return sortMessages([
              ...currentMessages,
              message,
            ]);
          },
        );
      },
      [],
    );

  const mergeMessages =
    useCallback(
      (
        history:
          NovaMessage[],
      ) => {
        setMessages(
          (
            currentMessages,
          ) => {
            const byId =
              new Map<
                string,
                NovaMessage
              >();

            for (
              const message
              of history
            ) {
              byId.set(
                message.id,
                message,
              );
            }

            for (
              const message
              of currentMessages
            ) {
              byId.set(
                message.id,
                message,
              );
            }

            return sortMessages(
              Array.from(
                byId.values(),
              ),
            );
          },
        );
      },
      [],
    );

  /*
   * Conectamos Socket solamente
   * cuando existe una Conversation.
   */
  const connectSessionSocket =
    useCallback(
      (
        novaSession:
          NovaSession,
      ) => {
        if (
          socketRef.current
        ) {
          return;
        }

        conversationClosedRef.current =
          false;

        socketRef.current =
          connectNovaSocket(
            novaSession.visitorToken,
            novaSession.conversation.id,
            {
              async onJoined() {
                conversationClosedRef.current =
                  false;

                setConnectionStatus(
                  'En línea',
                );

                try {
                  const history =
                    await getNovaMessages(
                      novaSession.visitorToken,
                      novaSession
                        .conversation
                        .id,
                    );

                  mergeMessages(
                    history,
                  );
                } catch (
                  err
                ) {
                  console.error(
                    err,
                  );

                  setError(
                    err instanceof
                      Error
                      ? err.message
                      : 'No se pudo cargar el historial',
                  );
                }
              },

              onMessage(
                message,
              ) {
                addMessage(
                  message,
                );
              },

              onConversationUpdated(
                conversation,
              ) {
                if (
                  conversation.id !==
                  novaSession
                    .conversation
                    .id
                ) {
                  return;
                }

                setSession(
                  (
                    currentSession,
                  ) => {
                    if (
                      !currentSession ||
                      currentSession
                        .conversation
                        .id !==
                        conversation.id
                    ) {
                      return currentSession;
                    }

                    return {
                      ...currentSession,

                      conversation,
                    };
                  },
                );

                if (
                  conversation.status !==
                  'CLOSED'
                ) {
                  return;
                }

                /*
                 * El agente cerró la
                 * Conversation.
                 */
                conversationClosedRef.current =
                  true;

                setConnectionStatus(
                  'Finalizada',
                );

                setError(
                  null,
                );

                setInput(
                  '',
                );

                setSending(
                  false,
                );

                setSelectedImage(
                  null,
                );

                setImagePreview(
                  null,
                );

                if (
                  fileInputRef.current
                ) {
                  fileInputRef.current.value =
                    '';
                }

                /*
                 * Ya no necesitamos mantener
                 * Socket abierto para una
                 * conversación cerrada.
                 */
                socketRef.current
                  ?.disconnect();

                socketRef.current =
                  null;
              },

              onDisconnect() {
                /*
                 * Si nosotros desconectamos
                 * porque CLOSED, conservamos:
                 *
                 * Finalizada
                 */
                if (
                  conversationClosedRef.current
                ) {
                  return;
                }

                setConnectionStatus(
                  'Desconectado',
                );
              },

              onError(
                message,
              ) {
                setError(
                  message,
                );
              },
            },
          );
      },
      [
        addMessage,
        mergeMessages,
      ],
    );

  /*
   * Al cargar solamente obtenemos
   * configuración pública.
   *
   * Aquí NO se crea Visitor.
   * Aquí NO se crea Conversation.
   */
  useEffect(
    () => {
      let cancelled =
        false;

      async function loadConfig() {
        try {
          const novaConfig =
            await getNovaConfig();

          if (
            cancelled
          ) {
            return;
          }

          setConfig(
            novaConfig,
          );

          setConfigError(
            null,
          );
        } catch (
          err
        ) {
          console.error(
            'Error cargando configuración Nova:',
            err,
          );

          if (
            cancelled
          ) {
            return;
          }

          setConfigError(
            err instanceof
              Error
              ? err.message
              : 'Widget no disponible',
          );
        }
      }

      void loadConfig();

      return () => {
        cancelled =
          true;
      };
    },
    [],
  );

  /*
   * Desconecta Socket al desmontar.
   */
  useEffect(
    () => {
      return () => {
        socketRef.current
          ?.disconnect();

        socketRef.current =
          null;
      };
    },
    [],
  );

  /*
   * Scroll automático.
   */
  useEffect(
    () => {
      if (
        !isOpen
      ) {
        return;
      }

      messagesEndRef.current
        ?.scrollIntoView({
          behavior:
            'smooth',
        });
    },
    [
      messages,
      isOpen,
      session,
    ],
  );

  /*
   * Libera preview de imágenes.
   */
  useEffect(
    () => {
      if (
        !imagePreview
      ) {
        return;
      }

      return () => {
        URL.revokeObjectURL(
          imagePreview,
        );
      };
    },
    [
      imagePreview,
    ],
  );

  /*
   * Comunicación con loader.js.
   *
   * Si estamos dentro de iframe,
   * notificamos cada cambio:
   *
   * abierto / cerrado
   * LEFT / RIGHT
   */
  useEffect(
    () => {
      if (
        window.parent ===
        window
      ) {
        return;
      }

      if (
        !config
      ) {
        return;
      }

      window.parent.postMessage(
        {
          source:
            'nova-widget',

          type:
            'nova:state',

          open:
            isOpen,

          position:
            config.position,
        },
        '*',
      );
    },
    [
      config,
      isOpen,
    ],
  );

  /*
   * Al abrir:
   *
   * Si nunca habló:
   * NO se crea nada.
   *
   * Si ya existe sesión:
   * restauramos historial + Socket.
   */
  async function initializeNovaSession() {
    if (
      session ||
      socketRef.current ||
      initializingRef.current
    ) {
      return;
    }

    initializingRef.current =
      true;

    setInitializingSession(
      true,
    );

    try {
      setConnectionStatus(
        'Conectando...',
      );

      setError(
        null,
      );

      const restoredSession =
        await restoreNovaSession();

      if (
        !restoredSession
      ) {
        conversationClosedRef.current =
          false;

        setConnectionStatus(
          'Disponible',
        );

        return;
      }

      conversationClosedRef.current =
        false;

      setSession(
        restoredSession,
      );

      connectSessionSocket(
        restoredSession,
      );
    } catch (
      err
    ) {
      console.error(
        err,
      );

      setConnectionStatus(
        'Error',
      );

      setError(
        err instanceof
          Error
          ? err.message
          : 'Error al iniciar Nova',
      );
    } finally {
      initializingRef.current =
        false;

      setInitializingSession(
        false,
      );
    }
  }

  function handleOpenWidget() {
    setIsOpen(
      true,
    );

    void initializeNovaSession();
  }

  function clearSelectedImage() {
    setSelectedImage(
      null,
    );

    setImagePreview(
      null,
    );

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        '';
    }
  }

  /*
   * El usuario decide iniciar otro
   * contacto después del cierre.
   *
   * Conservamos Visitor.
   * Olvidamos solamente Conversation.
   *
   * No creamos otra Conversation hasta
   * que envíe el primer mensaje.
   */
  function handleStartNewConversation() {
    socketRef.current
      ?.disconnect();

    socketRef.current =
      null;

    resetNovaSessionCache();

    conversationClosedRef.current =
      false;

    setSession(
      null,
    );

    setMessages(
      [],
    );

    setInput(
      '',
    );

    setError(
      null,
    );

    setSending(
      false,
    );

    setSelectedImage(
      null,
    );

    setImagePreview(
      null,
    );

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        '';
    }

    setConnectionStatus(
      'Disponible',
    );
  }

  function openFilePicker() {
    fileInputRef.current
      ?.click();
  }

  function handleImageSelected(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    if (
      session
        ?.conversation
        .status ===
      'CLOSED'
    ) {
      return;
    }

    const file =
      event.target
        .files?.[0];

    if (
      !file
    ) {
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (
      !allowedTypes.includes(
        file.type,
      )
    ) {
      setError(
        'Formato no permitido. Usa JPG, PNG, WEBP o GIF.',
      );

      event.target.value =
        '';

      return;
    }

    const maxSize =
      5 *
      1024 *
      1024;

    if (
      file.size >
      maxSize
    ) {
      setError(
        'La imagen no puede superar los 5 MB.',
      );

      event.target.value =
        '';

      return;
    }

    setSelectedImage(
      file,
    );

    setImagePreview(
      URL.createObjectURL(
        file,
      ),
    );

    setError(
      null,
    );
  }

  async function handleSubmit(
    event:
      SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    /*
     * Segunda protección frontend.
     *
     * El backend además continúa
     * bloqueando CLOSED.
     */
    if (
      session
        ?.conversation
        .status ===
      'CLOSED'
    ) {
      return;
    }

    if (
      sending ||
      initializingSession
    ) {
      return;
    }

    const content =
      input.trim();

    if (
      !content &&
      !selectedImage
    ) {
      return;
    }

    try {
      setSending(
        true,
      );

      setError(
        null,
      );

      /*
       * PRIMER ENVÍO REAL:
       *
       * recién aquí se crea
       * Visitor + Conversation.
       */
      let activeSession =
        session;

      if (
        !activeSession
      ) {
        setConnectionStatus(
          'Conectando...',
        );

        activeSession =
          await getNovaSession();

        conversationClosedRef.current =
          false;

        setSession(
          activeSession,
        );

        connectSessionSocket(
          activeSession,
        );
      }

      let message:
        NovaMessage;

      if (
        selectedImage
      ) {
        message =
          await sendNovaImageMessage(
            activeSession.visitorToken,
            activeSession
              .conversation
              .id,
            selectedImage,
            content ||
              undefined,
          );

        clearSelectedImage();
      } else {
        message =
          await sendNovaTextMessage(
            activeSession.visitorToken,
            activeSession
              .conversation
              .id,
            content,
          );
      }

      addMessage(
        message,
      );

      setInput(
        '',
      );
    } catch (
      err
    ) {
      console.error(
        err,
      );

      setError(
        err instanceof
          Error
          ? err.message
          : 'No se pudo enviar el mensaje',
      );
    } finally {
      setSending(
        false,
      );
    }
  }

  if (
    !config &&
    configError
  ) {
    return null;
  }

  if (
    !config
  ) {
    return null;
  }

  const conversationClosed =
    session
      ?.conversation
      .status ===
    'CLOSED';

  const positionClass =
    config.position ===
    'LEFT'
      ? 'nova-widget-shell--left'
      : 'nova-widget-shell--right';

  const statusClass =
    conversationClosed
      ? 'nova-chat__status nova-chat__status--closed'
      : connectionStatus ===
          'En línea'
        ? 'nova-chat__status nova-chat__status--online'
        : connectionStatus ===
              'Desconectado' ||
            connectionStatus ===
              'Error'
          ? 'nova-chat__status nova-chat__status--offline'
          : 'nova-chat__status';

  const brandInitial =
    config.title
      .charAt(
        0,
      )
      .toUpperCase();

  return (
    <div
      className={`nova-widget-shell ${positionClass}`}
    >
      {isOpen ? (
        <section
          className="nova-chat"
          aria-label={`Chat de soporte ${config.title}`}
        >
          <header className="nova-chat__header">
            <div className="nova-chat__identity">
              <div className="nova-chat__avatar">
                {
                  brandInitial
                }
              </div>

              <div className="nova-chat__identity-text">
                <h1>
                  {
                    config.title
                  }
                </h1>

                <p>
                  {
                    config.subtitle
                  }
                </p>
              </div>
            </div>

            <div className="nova-chat__header-actions">
              <span
                className={
                  statusClass
                }
              >
                <span className="nova-chat__status-dot" />

                {
                  conversationClosed
                    ? 'Finalizada'
                    : connectionStatus
                }
              </span>

              <button
                type="button"
                className="nova-chat__close"
                onClick={() => {
                  setIsOpen(
                    false,
                  );
                }}
                aria-label="Minimizar chat"
                title="Minimizar"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M6 9l6 6 6-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </header>

          <div
            className="nova-chat__messages"
            aria-live="polite"
          >
            <div className="nova-chat__welcome">
              <div className="nova-chat__welcome-avatar">
                {
                  brandInitial
                }
              </div>

              <div className="nova-chat__welcome-content">
                <span>
                  Soporte
                </span>

                <div>
                  {
                    config.welcomeMessage
                  }
                </div>
              </div>
            </div>

            {messages.map(
              (
                message,
              ) => (
                <div
                  key={
                    message.id
                  }
                  className={
                    message.senderType ===
                    'VISITOR'
                      ? 'nova-message nova-message--visitor'
                      : 'nova-message nova-message--agent'
                  }
                >
                  {message.type ===
                  'IMAGE' ? (
                    <>
                      {message.mediaUrl ? (
                        <img
                          src={`${NOVA_API_URL}${message.mediaUrl}`}
                          alt="Imagen enviada"
                          className="nova-message__image"
                        />
                      ) : null}

                      {message.content ? (
                        <div className="nova-message__content">
                          {
                            message.content
                          }
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="nova-message__content">
                      {
                        message.content
                      }
                    </div>
                  )}

                  <div className="nova-message__time">
                    {formatMessageTime(
                      message.createdAt,
                    )}
                  </div>
                </div>
              ),
            )}

            {conversationClosed ? (
              <div
                className="nova-chat__closed-notice"
                role="status"
              >
                <div className="nova-chat__closed-notice-icon">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12.5l4 4L19 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="nova-chat__closed-notice-content">
                  <strong>
                    Conversación finalizada
                  </strong>

                  <span>
                    El equipo de soporte ha cerrado esta conversación.
                  </span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div
                className="nova-chat__error"
                role="alert"
              >
                <div className="nova-chat__error-icon">
                  !
                </div>

                <span>
                  {
                    error
                  }
                </span>

                <button
                  type="button"
                  aria-label="Cerrar error"
                  onClick={() => {
                    setError(
                      null,
                    );
                  }}
                >
                  ×
                </button>
              </div>
            ) : null}

            <div
              ref={
                messagesEndRef
              }
            />
          </div>

          {conversationClosed ? (
            <div className="nova-chat__closed-area">
              <button
                type="button"
                className="nova-chat__new-conversation"
                onClick={
                  handleStartNewConversation
                }
              >
                Iniciar nueva conversación
              </button>

              <div className="nova-chat__powered">
                Atención mediante

                <strong>
                  Nova
                </strong>
              </div>
            </div>
          ) : (
            <>
              {imagePreview ? (
                <div className="nova-image-preview">
                  <div className="nova-image-preview__container">
                    <img
                      src={
                        imagePreview
                      }
                      alt="Vista previa"
                      className="nova-image-preview__image"
                    />

                    <button
                      type="button"
                      className="nova-image-preview__remove"
                      onClick={
                        clearSelectedImage
                      }
                      aria-label="Quitar imagen"
                      title="Quitar imagen"
                    >
                      ×
                    </button>
                  </div>

                  <div className="nova-image-preview__info">
                    <strong>
                      Imagen seleccionada
                    </strong>

                    <span>
                      {
                        selectedImage?.name
                      }
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="nova-chat__composer-area">
                <form
                  className="nova-chat__composer"
                  onSubmit={
                    handleSubmit
                  }
                >
                  <input
                    ref={
                      fileInputRef
                    }
                    className="nova-chat__file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={
                      handleImageSelected
                    }
                  />

                  <button
                    type="button"
                    className="nova-chat__attach"
                    onClick={
                      openFilePicker
                    }
                    disabled={
                      sending ||
                      initializingSession
                    }
                    title="Adjuntar imagen"
                    aria-label="Adjuntar imagen"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M8.5 12.5l5.8-5.8a3 3 0 114.2 4.2l-7.9 7.9a5 5 0 01-7.1-7.1l8.4-8.4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <div className="nova-chat__input-wrap">
                    <input
                      type="text"
                      value={
                        input
                      }
                      onChange={(
                        event,
                      ) => {
                        setInput(
                          event.target.value,
                        );
                      }}
                      placeholder={
                        selectedImage
                          ? 'Añade un mensaje...'
                          : 'Escribe un mensaje...'
                      }
                      disabled={
                        sending ||
                        initializingSession
                      }
                      aria-label="Mensaje"
                    />
                  </div>

                  <button
                    type="submit"
                    className="nova-chat__send"
                    disabled={
                      sending ||
                      initializingSession ||
                      (
                        !input.trim() &&
                        !selectedImage
                      )
                    }
                  >
                    {sending ? (
                      <span className="nova-chat__sending">
                        …
                      </span>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 12h13M13 6l6 6-6 6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}

                    <span className="nova-chat__send-label">
                      Enviar
                    </span>
                  </button>
                </form>

                <div className="nova-chat__powered">
                  Atención mediante

                  <strong>
                    Nova
                  </strong>
                </div>
              </div>
            </>
          )}
        </section>
      ) : (
        <button
          type="button"
          className="nova-launcher"
          onClick={
            handleOpenWidget
          }
          aria-label={`Abrir chat de ${config.title}`}
          title="Abrir chat"
        >
          <span className="nova-launcher__pulse" />

          <span className="nova-launcher__icon">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M5.5 5.5h13a2.5 2.5 0 012.5 2.5v7a2.5 2.5 0 01-2.5 2.5H11l-4.5 3v-3h-1A2.5 2.5 0 013 15V8a2.5 2.5 0 012.5-2.5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d="M8 11.5h.01M12 11.5h.01M16 11.5h.01"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

export default App;