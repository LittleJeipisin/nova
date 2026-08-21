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
  sendNovaAudioMessage,
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

function formatRecordingTime(
  seconds:
    number,
) {
  const minutes =
    Math.floor(
      seconds /
        60,
    );

  const remainingSeconds =
    seconds %
    60;

  return `${minutes
    .toString()
    .padStart(
      2,
      '0',
    )}:${remainingSeconds
    .toString()
    .padStart(
      2,
      '0',
    )}`;
}

function getPreferredAudioMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  for (
    const type
    of types
  ) {
    if (
      MediaRecorder.isTypeSupported(
        type,
      )
    ) {
      return type;
    }
  }

  return '';
}

function getAudioExtension(
  mimeType:
    string,
) {
  const cleanMime =
    mimeType
      .split(';')[0]
      .toLowerCase();

  if (
    cleanMime ===
    'audio/mp4'
  ) {
    return 'm4a';
  }

  if (
    cleanMime ===
    'audio/ogg'
  ) {
    return 'ogg';
  }

  if (
    cleanMime ===
      'audio/mpeg' ||
    cleanMime ===
      'audio/mp3'
  ) {
    return 'mp3';
  }

  if (
    cleanMime ===
      'audio/wav' ||
    cleanMime ===
      'audio/x-wav'
  ) {
    return 'wav';
  }

  return 'webm';
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
    recording,
    setRecording,
  ] =
    useState(
      false,
    );

  const [
    recordingSeconds,
    setRecordingSeconds,
  ] =
    useState(
      0,
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

  const conversationClosedRef =
    useRef(
      false,
    );

  const mediaRecorderRef =
    useRef<
      MediaRecorder | null
    >(
      null,
    );

  const mediaStreamRef =
    useRef<
      MediaStream | null
    >(
      null,
    );

  const audioChunksRef =
    useRef<
      Blob[]
    >([]);

  const recordingTimerRef =
    useRef<
      number | null
    >(
      null,
    );

  const cancelRecordingRef =
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

  function clearRecordingTimer() {
    if (
      recordingTimerRef.current ===
      null
    ) {
      return;
    }

    window.clearInterval(
      recordingTimerRef.current,
    );

    recordingTimerRef.current =
      null;
  }

  function stopMediaStream() {
    const stream =
      mediaStreamRef.current;

    if (
      !stream
    ) {
      return;
    }

    for (
      const track
      of stream.getTracks()
    ) {
      track.stop();
    }

    mediaStreamRef.current =
      null;
  }

  function cleanupRecording() {
    clearRecordingTimer();

    stopMediaStream();

    mediaRecorderRef.current =
      null;

    audioChunksRef.current =
      [];

    setRecording(
      false,
    );

    setRecordingSeconds(
      0,
    );
  }

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
            novaSession
              .conversation
              .id,
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

                conversationClosedRef.current =
                  true;

                const recorder =
                  mediaRecorderRef.current;

                if (
                  recorder &&
                  recorder.state !==
                    'inactive'
                ) {
                  cancelRecordingRef.current =
                    true;

                  recorder.stop();
                }

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

                socketRef.current
                  ?.disconnect();

                socketRef.current =
                  null;
              },

              onDisconnect() {
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

  useEffect(
    () => {
      return () => {
        socketRef.current
          ?.disconnect();

        socketRef.current =
          null;

        clearRecordingTimer();

        stopMediaStream();
      };
    },
    [],
  );

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

  function handleStartNewConversation() {
    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state !==
        'inactive'
    ) {
      cancelRecordingRef.current =
        true;

      recorder.stop();
    }

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

  async function sendRecordedAudio(
    blob:
      Blob,
  ) {
    if (
      blob.size ===
      0
    ) {
      setError(
        'No se pudo generar el audio.',
      );

      return;
    }

    try {
      setSending(
        true,
      );

      setError(
        null,
      );

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

      if (
        activeSession
          .conversation
          .status ===
        'CLOSED'
      ) {
        return;
      }

      const mimeType =
        blob.type ||
        'audio/webm';

      const extension =
        getAudioExtension(
          mimeType,
        );

      const file =
        new File(
          [
            blob,
          ],
          `audio-${Date.now()}.${extension}`,
          {
            type:
              mimeType,
          },
        );

      const message =
        await sendNovaAudioMessage(
          activeSession.visitorToken,
          activeSession
            .conversation
            .id,
          file,
        );

      addMessage(
        message,
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
          : 'No se pudo enviar el audio',
      );
    } finally {
      setSending(
        false,
      );
    }
  }

  async function handleStartRecording() {
    if (
      recording ||
      sending ||
      initializingSession
    ) {
      return;
    }

    if (
      session
        ?.conversation
        .status ===
      'CLOSED'
    ) {
      return;
    }

    if (
      selectedImage
    ) {
      setError(
        'Quita la imagen seleccionada antes de grabar un audio.',
      );

      return;
    }

    if (
      typeof MediaRecorder ===
        'undefined' ||
      !navigator.mediaDevices
        ?.getUserMedia
    ) {
      setError(
        'Tu navegador no permite grabar audio desde este chat.',
      );

      return;
    }

    try {
      setError(
        null,
      );

      const stream =
        await navigator.mediaDevices
          .getUserMedia({
            audio:
              true,
          });

      mediaStreamRef.current =
        stream;

      const preferredMimeType =
        getPreferredAudioMimeType();

      const recorder =
        preferredMimeType
          ? new MediaRecorder(
              stream,
              {
                mimeType:
                  preferredMimeType,
              },
            )
          : new MediaRecorder(
              stream,
            );

      mediaRecorderRef.current =
        recorder;

      audioChunksRef.current =
        [];

      cancelRecordingRef.current =
        false;

      recorder.ondataavailable =
        (
          event,
        ) => {
          if (
            event.data.size >
            0
          ) {
            audioChunksRef.current.push(
              event.data,
            );
          }
        };

      recorder.onerror =
        () => {
          setError(
            'Ocurrió un error mientras se grababa el audio.',
          );
        };

      recorder.onstop =
        () => {
          const cancelled =
            cancelRecordingRef.current;

          const chunks = [
            ...audioChunksRef.current,
          ];

          const mimeType =
            recorder.mimeType ||
            preferredMimeType ||
            'audio/webm';

          cleanupRecording();

          cancelRecordingRef.current =
            false;

          if (
            cancelled
          ) {
            return;
          }

          const blob =
            new Blob(
              chunks,
              {
                type:
                  mimeType,
              },
            );

          void sendRecordedAudio(
            blob,
          );
        };

      recorder.start(
        250,
      );

      setRecording(
        true,
      );

      setRecordingSeconds(
        0,
      );

      recordingTimerRef.current =
        window.setInterval(
          () => {
            setRecordingSeconds(
              (
                current,
              ) =>
                current +
                1,
            );
          },
          1000,
        );
    } catch (
      err
    ) {
      console.error(
        err,
      );

      cleanupRecording();

      if (
        err instanceof
          DOMException &&
        (
          err.name ===
            'NotAllowedError' ||
          err.name ===
            'PermissionDeniedError'
        )
      ) {
        setError(
          'Debes permitir el acceso al micrófono para enviar audios.',
        );

        return;
      }

      setError(
        'No se pudo acceder al micrófono.',
      );
    }
  }

  function handleStopRecording() {
    const recorder =
      mediaRecorderRef.current;

    if (
      !recorder ||
      recorder.state ===
        'inactive'
    ) {
      return;
    }

    cancelRecordingRef.current =
      false;

    recorder.stop();
  }

  function handleCancelRecording() {
    const recorder =
      mediaRecorderRef.current;

    if (
      !recorder ||
      recorder.state ===
        'inactive'
    ) {
      cleanupRecording();

      return;
    }

    cancelRecordingRef.current =
      true;

    recorder.stop();
  }

  async function handleSubmit(
    event:
      SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      recording
    ) {
      return;
    }

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

  const conversationPending =
    session
      ?.conversation
      .status ===
    'PENDING';

  const positionClass =
    config.position ===
    'LEFT'
      ? 'nova-widget-shell--left'
      : 'nova-widget-shell--right';

  const statusClass =
    conversationClosed
      ? 'nova-chat__status nova-chat__status--closed'
      : conversationPending
        ? 'nova-chat__status nova-chat__status--pending'
        : connectionStatus ===
            'En línea'
          ? 'nova-chat__status nova-chat__status--online'
          : connectionStatus ===
                'Desconectado' ||
              connectionStatus ===
                'Error'
            ? 'nova-chat__status nova-chat__status--offline'
            : 'nova-chat__status';

  const visibleStatus =
    conversationClosed
      ? 'Finalizada'
      : conversationPending
        ? 'En espera'
        : connectionStatus;

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
                  visibleStatus
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
                  ) : message.type ===
                    'AUDIO' ? (
                    <>
                      {message.mediaUrl ? (
                        <audio
                          className="nova-message__audio"
                          controls
                          preload="metadata"
                          src={`${NOVA_API_URL}${message.mediaUrl}`}
                        >
                          Tu navegador no permite reproducir audio.
                        </audio>
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

            {conversationPending ? (
              <div
                className="nova-chat__pending-notice"
                role="status"
              >
                <div className="nova-chat__pending-notice-icon">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 7v5l3 2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <circle
                      cx="12"
                      cy="12"
                      r="8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </div>

                <div className="nova-chat__pending-notice-content">
                  <strong>
                    Conversación en espera
                  </strong>

                  <span>
                    El equipo de soporte retomará tu atención pronto. Puedes seguir enviando mensajes.
                  </span>
                </div>
              </div>
            ) : null}

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
          ) : recording ? (
            <div className="nova-chat__recording-area">
              <div className="nova-chat__recording">
                <span className="nova-chat__recording-dot" />

                <strong>
                  Grabando
                </strong>

                <span>
                  {formatRecordingTime(
                    recordingSeconds,
                  )}
                </span>
              </div>

              <div className="nova-chat__recording-actions">
                <button
                  type="button"
                  className="nova-chat__recording-cancel"
                  onClick={
                    handleCancelRecording
                  }
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="nova-chat__recording-send"
                  onClick={
                    handleStopRecording
                  }
                >
                  Enviar audio
                </button>
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
                    type="button"
                    className="nova-chat__microphone"
                    disabled={
                      sending ||
                      initializingSession
                    }
                    onClick={() => {
                      void handleStartRecording();
                    }}
                    aria-label="Grabar audio"
                    title="Grabar audio"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <rect
                        x="9"
                        y="3"
                        width="6"
                        height="11"
                        rx="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />

                      <path
                        d="M6.5 11a5.5 5.5 0 0011 0M12 16.5V21M9 21h6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

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