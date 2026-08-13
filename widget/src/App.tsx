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
  sendNovaImageMessage,
  sendNovaTextMessage,
} from './nova';

import type {
  NovaMessage,
  NovaSession,
  NovaWidgetConfig,
} from './nova';

function formatMessageTime(createdAt: string) {
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(createdAt));
}

function sortMessages(messages: NovaMessage[]) {
  return [...messages].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime(),
  );
}

function App() {
  const [
    config,
    setConfig,
  ] = useState<NovaWidgetConfig | null>(null);

  const [
    configError,
    setConfigError,
  ] = useState<string | null>(null);

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    connectionStatus,
    setConnectionStatus,
  ] = useState('Conectando...');

  const [
    session,
    setSession,
  ] = useState<NovaSession | null>(null);

  const [
    messages,
    setMessages,
  ] = useState<NovaMessage[]>([]);

  const [
    input,
    setInput,
  ] = useState('');

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState<File | null>(null);

  const [
    imagePreview,
    setImagePreview,
  ] = useState<string | null>(null);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const socketRef =
    useRef<ReturnType<typeof connectNovaSocket> | null>(null);

  const initializingRef =
    useRef(false);

  const addMessage = useCallback(
    (message: NovaMessage) => {
      setMessages((currentMessages) => {
        const alreadyExists =
          currentMessages.some(
            (currentMessage) =>
              currentMessage.id === message.id,
          );

        if (alreadyExists) {
          return currentMessages;
        }

        return sortMessages([
          ...currentMessages,
          message,
        ]);
      });
    },
    [],
  );

  const mergeMessages = useCallback(
    (history: NovaMessage[]) => {
      setMessages((currentMessages) => {
        const byId =
          new Map<string, NovaMessage>();

        for (const message of history) {
          byId.set(message.id, message);
        }

        for (const message of currentMessages) {
          byId.set(message.id, message);
        }

        return sortMessages(
          Array.from(byId.values()),
        );
      });
    },
    [],
  );

  /*
   * Cargamos únicamente la configuración
   * pública al cargar la página.
   *
   * Esto NO crea Visitor ni conversación.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const novaConfig =
          await getNovaConfig();

        if (cancelled) {
          return;
        }

        setConfig(novaConfig);
        setConfigError(null);
      } catch (err) {
        console.error(
          'Error cargando configuración Nova:',
          err,
        );

        if (cancelled) {
          return;
        }

        setConfigError(
          err instanceof Error
            ? err.message
            : 'Widget no disponible',
        );
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Desconectamos Socket únicamente cuando
   * el componente realmente se desmonta.
   */
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [
    messages,
    isOpen,
  ]);

  useEffect(() => {
    if (!imagePreview) {
      return;
    }

    return () => {
      URL.revokeObjectURL(
        imagePreview,
      );
    };
  }, [imagePreview]);

  async function initializeNovaSession() {
    if (
      session ||
      socketRef.current ||
      initializingRef.current
    ) {
      return;
    }

    initializingRef.current = true;

    try {
      setConnectionStatus(
        'Conectando...',
      );

      setError(null);

      const novaSession =
        await getNovaSession();

      setSession(
        novaSession,
      );

      socketRef.current =
        connectNovaSocket(
          novaSession.visitorToken,
          novaSession.conversation.id,
          {
            async onJoined() {
              setConnectionStatus(
                'En línea',
              );

              try {
                const history =
                  await getNovaMessages(
                    novaSession.visitorToken,
                    novaSession.conversation.id,
                  );

                mergeMessages(
                  history,
                );
              } catch (err) {
                console.error(
                  err,
                );

                setError(
                  err instanceof Error
                    ? err.message
                    : 'No se pudo cargar el historial',
                );
              }
            },

            onMessage(message) {
              addMessage(
                message,
              );
            },

            onDisconnect() {
              setConnectionStatus(
                'Desconectado',
              );
            },

            onError(message) {
              setError(
                message,
              );
            },
          },
        );
    } catch (err) {
      console.error(
        err,
      );

      setConnectionStatus(
        'Error',
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Error al iniciar Nova',
      );
    } finally {
      initializingRef.current = false;
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

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleImageSelected(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
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
      5 * 1024 * 1024;

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
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !session ||
      sending
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

      let message: NovaMessage;

      if (selectedImage) {
        message =
          await sendNovaImageMessage(
            session.visitorToken,
            session.conversation.id,
            selectedImage,
            content || undefined,
          );

        clearSelectedImage();
      } else {
        message =
          await sendNovaTextMessage(
            session.visitorToken,
            session.conversation.id,
            content,
          );
      }

      addMessage(
        message,
      );

      setInput(
        '',
      );
    } catch (err) {
      console.error(
        err,
      );

      setError(
        err instanceof Error
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

  if (!config) {
    return null;
  }

  const positionClass =
    config.position === 'LEFT'
      ? 'nova-widget-shell--left'
      : 'nova-widget-shell--right';

  return (
    <div
      className={`nova-widget-shell ${positionClass}`}
    >
      {isOpen && (
        <section
          className="nova-chat"
          aria-label={`Chat de soporte ${config.title}`}
        >
          <header className="nova-chat__header">
            <div className="nova-chat__identity">
              <div className="nova-chat__avatar">
                {config.title
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <h1>
                  {config.title}
                </h1>

                <p>
                  {config.subtitle}
                </p>
              </div>
            </div>

            <div className="nova-chat__header-actions">
              <span className="nova-chat__status">
                {connectionStatus}
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
                ×
              </button>
            </div>
          </header>

          <div className="nova-chat__messages">
            <div className="nova-message nova-message--system">
              {config.welcomeMessage}
            </div>

            {messages.map(
              (message) => (
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
                      {message.mediaUrl && (
                        <img
                          src={`${NOVA_API_URL}${message.mediaUrl}`}
                          alt="Imagen enviada"
                          className="nova-message__image"
                        />
                      )}

                      {message.content && (
                        <div className="nova-message__content">
                          {
                            message.content
                          }
                        </div>
                      )}
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

            {error && (
              <div className="nova-message nova-message--error">
                {error}
              </div>
            )}

            <div
              ref={
                messagesEndRef
              }
            />
          </div>

          {imagePreview && (
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
                  {selectedImage?.name}
                </span>
              </div>
            </div>
          )}

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
                !session ||
                sending
              }
              title="Adjuntar imagen"
              aria-label="Adjuntar imagen"
            >
              📎
            </button>

            <input
              type="text"
              value={
                input
              }
              onChange={
                (event) => {
                  setInput(
                    event.target.value,
                  );
                }
              }
              placeholder={
                selectedImage
                  ? 'Añade un mensaje...'
                  : 'Escribe un mensaje...'
              }
              disabled={
                !session ||
                sending
              }
            />

            <button
              type="submit"
              className="nova-chat__send"
              disabled={
                !session ||
                sending ||
                (
                  !input.trim() &&
                  !selectedImage
                )
              }
            >
              {sending
                ? '...'
                : 'Enviar'}
            </button>
          </form>
        </section>
      )}

      {!isOpen && (
        <button
          type="button"
          className="nova-launcher"
          onClick={
            handleOpenWidget
          }
          aria-label={`Abrir chat de ${config.title}`}
          title="Abrir chat"
        >
          <span className="nova-launcher__icon">
            💬
          </span>
        </button>
      )}
    </div>
  );
}

export default App;