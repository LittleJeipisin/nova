import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { Socket } from 'socket.io-client';

import {
  getStoredAccessToken,
  NOVA_API_URL,
} from '../auth/auth';

import type { AuthUser } from '../auth/auth';

import {
  getConversation,
  getConversations,
} from '../lib/api';

import {
  connectAgentSocket,
  joinAgentConversation,
} from '../lib/socket';

import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
} from '../types/chat';

type InboxPageProps = {
  user: AuthUser;
  onLogout: () => void;
};

function sortConversations(
  conversations: ConversationSummary[],
) {
  return [...conversations].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() -
      new Date(a.updatedAt).getTime(),
  );
}

function sortMessages(
  messages: ChatMessage[],
) {
  return [...messages].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime(),
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function getLastMessage(
  conversation: ConversationSummary,
) {
  const message = conversation.messages[0];

  if (!message) {
    return 'Sin mensajes';
  }

  if (message.type === 'IMAGE') {
    return message.content
      ? `📷 ${message.content}`
      : '📷 Imagen';
  }

  return message.content ?? 'Mensaje';
}

function AppStatus({
  status,
}: {
  status: ConversationSummary['status'];
}) {
  if (status === 'OPEN') {
    return (
      <span className="nova-inbox__status nova-inbox__status--open">
        Abierta
      </span>
    );
  }

  if (status === 'PENDING') {
    return (
      <span className="nova-inbox__status nova-inbox__status--pending">
        Pendiente
      </span>
    );
  }

  return (
    <span className="nova-inbox__status nova-inbox__status--closed">
      Cerrada
    </span>
  );
}

export function InboxPage({
  user,
  onLogout,
}: InboxPageProps) {
  const workspaceId =
    user.workspaceId ?? '';

  const [
    conversations,
    setConversations,
  ] = useState<ConversationSummary[]>([]);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState<string | null>(null);

  const [
    activeConversation,
    setActiveConversation,
  ] =
    useState<ConversationDetail | null>(
      null,
    );

  const [
    loadingConversations,
    setLoadingConversations,
  ] = useState(true);

  const [
    loadingConversation,
    setLoadingConversation,
  ] = useState(false);

  const [
    socketStatus,
    setSocketStatus,
  ] = useState('Conectando...');

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const socketRef =
    useRef<Socket | null>(null);

  const selectedConversationIdRef =
    useRef<string | null>(null);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const upsertConversation =
    useCallback(
      (
        conversation:
          ConversationSummary,
      ) => {
        setConversations(
          (
            currentConversations,
          ) => {
            const withoutCurrent =
              currentConversations.filter(
                (current) =>
                  current.id !==
                  conversation.id,
              );

            return sortConversations([
              conversation,
              ...withoutCurrent,
            ]);
          },
        );

        setActiveConversation(
          (current) => {
            if (
              !current ||
              current.id !==
                conversation.id
            ) {
              return current;
            }

            return {
              ...current,
              status:
                conversation.status,
              assignedAgentId:
                conversation.assignedAgentId,
              assignedAgent:
                conversation.assignedAgent,
              updatedAt:
                conversation.updatedAt,
              closedAt:
                conversation.closedAt,
            };
          },
        );
      },
      [],
    );

  const removeConversation =
    useCallback(
      (
        conversationId: string,
      ) => {
        setConversations(
          (
            currentConversations,
          ) =>
            currentConversations.filter(
              (conversation) =>
                conversation.id !==
                conversationId,
            ),
        );

        if (
          selectedConversationIdRef.current ===
          conversationId
        ) {
          selectedConversationIdRef.current =
            null;

          setSelectedConversationId(
            null,
          );

          setActiveConversation(
            null,
          );
        }
      },
      [],
    );

  const addMessage =
    useCallback(
      (message: ChatMessage) => {
        setActiveConversation(
          (current) => {
            if (
              !current ||
              current.id !==
                message.conversationId
            ) {
              return current;
            }

            const alreadyExists =
              current.messages.some(
                (
                  currentMessage,
                ) =>
                  currentMessage.id ===
                  message.id,
              );

            if (alreadyExists) {
              return current;
            }

            return {
              ...current,
              messages:
                sortMessages([
                  ...current.messages,
                  message,
                ]),
            };
          },
        );
      },
      [],
    );

  const loadConversation =
    useCallback(
      async (
        conversationId: string,
      ) => {
        if (!workspaceId) {
          return;
        }

        const accessToken =
          getStoredAccessToken() ??
          '';

        if (!accessToken) {
          onLogout();

          return;
        }

        try {
          setLoadingConversation(
            true,
          );

          setError(null);

          selectedConversationIdRef.current =
            conversationId;

          setSelectedConversationId(
            conversationId,
          );

          const conversation =
            await getConversation(
              accessToken,
              workspaceId,
              conversationId,
            );

          setActiveConversation(
            conversation,
          );

          const socket =
            socketRef.current;

          if (socket) {
            joinAgentConversation(
              socket,
              workspaceId,
              conversationId,
            );
          }
        } catch (err) {
          console.error(err);

          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar la conversación',
          );
        } finally {
          setLoadingConversation(
            false,
          );
        }
      },
      [
        onLogout,
        workspaceId,
      ],
    );

  useEffect(() => {
    if (
      user.role !== 'AGENT' ||
      !workspaceId
    ) {
      return;
    }

    const accessToken =
      getStoredAccessToken() ?? '';

    if (!accessToken) {
      onLogout();

      return;
    }

    let cancelled = false;

    const socket =
      connectAgentSocket(
        accessToken,
        workspaceId,
        {
          onWorkspaceJoined() {
            setSocketStatus(
              'En línea',
            );

            const conversationId =
              selectedConversationIdRef.current;

            const currentSocket =
              socketRef.current;

            if (
              conversationId &&
              currentSocket
            ) {
              joinAgentConversation(
                currentSocket,
                workspaceId,
                conversationId,
              );
            }
          },

          onConversationJoined() {
            setSocketStatus(
              'En línea',
            );
          },

          onMessage(message) {
            addMessage(
              message,
            );
          },

          onConversationUpdated(
            conversation,
          ) {
            upsertConversation(
              conversation,
            );
          },

          onConversationRemoved(
            conversationId,
          ) {
            removeConversation(
              conversationId,
            );
          },

          onDisconnect() {
            setSocketStatus(
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

    socketRef.current = socket;

    async function loadInbox() {
      try {
        setLoadingConversations(
          true,
        );

        setError(null);

        const result =
          await getConversations(
            accessToken,
            workspaceId,
          );

        if (cancelled) {
          return;
        }

        setConversations(
          sortConversations(
            result,
          ),
        );
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar las conversaciones',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingConversations(
            false,
          );
        }
      }
    }

    void loadInbox();

    return () => {
      cancelled = true;

      socket.disconnect();

      socketRef.current = null;
    };
  }, [
    addMessage,
    onLogout,
    removeConversation,
    upsertConversation,
    user.role,
    workspaceId,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: 'smooth',
      },
    );
  }, [
    activeConversation?.messages,
  ]);

  if (user.role !== 'AGENT') {
    return (
      <main className="nova-loading">
        Esta bandeja está disponible
        para AGENT.
      </main>
    );
  }

  if (!workspaceId) {
    return (
      <main className="nova-loading">
        El usuario no tiene un
        Workspace asociado.
      </main>
    );
  }

  return (
    <main className="nova-inbox">
      <header className="nova-inbox__header">
        <div className="nova-dashboard__brand">
          <div className="nova-dashboard__logo">
            N
          </div>

          <div className="nova-inbox__brand-text">
            <strong>
              Nova
            </strong>

            <span>
              Bandeja de atención
            </span>
          </div>
        </div>

        <div className="nova-inbox__header-right">
          <span className="nova-inbox__socket">
            {socketStatus}
          </span>

          <div className="nova-inbox__agent">
            <strong>
              {user.username}
            </strong>

            <span>
              {user.role}
            </span>
          </div>

          <button
            type="button"
            onClick={
              onLogout
            }
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="nova-inbox__layout">
        <aside className="nova-inbox__sidebar">
          <div className="nova-inbox__sidebar-header">
            <div>
              <h1>
                Conversaciones
              </h1>

              <p>
                {
                  conversations.length
                }{' '}
                asignadas
              </p>
            </div>
          </div>

          {loadingConversations ? (
            <div className="nova-inbox__empty">
              Cargando conversaciones...
            </div>
          ) : conversations.length ===
            0 ? (
            <div className="nova-inbox__empty">
              <strong>
                Sin conversaciones
              </strong>

              <span>
                No tienes conversaciones
                asignadas actualmente.
              </span>
            </div>
          ) : (
            <div className="nova-inbox__conversation-list">
              {conversations.map(
                (
                  conversation,
                ) => {
                  const selected =
                    selectedConversationId ===
                    conversation.id;

                  return (
                    <button
                      type="button"
                      key={
                        conversation.id
                      }
                      className={
                        selected
                          ? 'nova-inbox__conversation nova-inbox__conversation--selected'
                          : 'nova-inbox__conversation'
                      }
                      onClick={() => {
                        void loadConversation(
                          conversation.id,
                        );
                      }}
                    >
                      <div className="nova-inbox__conversation-top">
                        <strong>
                          Visitante{' '}
                          {conversation.visitor.id.slice(
                            0,
                            8,
                          )}
                        </strong>

                        <span>
                          {formatTime(
                            conversation.updatedAt,
                          )}
                        </span>
                      </div>

                      <div className="nova-inbox__conversation-preview">
                        {getLastMessage(
                          conversation,
                        )}
                      </div>

                      <div className="nova-inbox__conversation-bottom">
                        <AppStatus
                          status={
                            conversation.status
                          }
                        />
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          )}
        </aside>

        <section className="nova-inbox__chat">
          {!selectedConversationId ? (
            <div className="nova-inbox__placeholder">
              <div className="nova-inbox__placeholder-icon">
                💬
              </div>

              <h2>
                Selecciona una
                conversación
              </h2>

              <p>
                Elige una conversación
                de la bandeja para ver
                sus mensajes.
              </p>
            </div>
          ) : loadingConversation ? (
            <div className="nova-inbox__placeholder">
              Cargando conversación...
            </div>
          ) : activeConversation ? (
            <>
              <header className="nova-inbox__chat-header">
                <div>
                  <h2>
                    Visitante{' '}
                    {activeConversation.visitor.id.slice(
                      0,
                      8,
                    )}
                  </h2>

                  <span>
                    Última actividad:{' '}
                    {formatDateTime(
                      activeConversation
                        .visitor
                        .lastSeenAt,
                    )}
                  </span>
                </div>

                <AppStatus
                  status={
                    activeConversation.status
                  }
                />
              </header>

              <div className="nova-inbox__messages">
                {activeConversation
                  .messages.length ===
                0 ? (
                  <div className="nova-inbox__empty">
                    Esta conversación
                    todavía no tiene
                    mensajes.
                  </div>
                ) : (
                  activeConversation.messages.map(
                    (message) => (
                      <div
                        key={
                          message.id
                        }
                        className={
                          message.senderType ===
                          'USER'
                            ? 'nova-inbox-message nova-inbox-message--agent'
                            : 'nova-inbox-message nova-inbox-message--visitor'
                        }
                      >
                        {message.type ===
                        'IMAGE' ? (
                          <>
                            {message.mediaUrl && (
                              <img
                                src={`${NOVA_API_URL}${message.mediaUrl}`}
                                alt="Imagen del chat"
                              />
                            )}

                            {message.content && (
                              <div>
                                {
                                  message.content
                                }
                              </div>
                            )}
                          </>
                        ) : (
                          <div>
                            {
                              message.content
                            }
                          </div>
                        )}

                        <span>
                          {formatTime(
                            message.createdAt,
                          )}
                        </span>
                      </div>
                    ),
                  )
                )}

                <div
                  ref={
                    messagesEndRef
                  }
                />
              </div>

              <footer className="nova-inbox__composer-placeholder">
                En el siguiente paso
                habilitaremos respuestas
                del agente.
              </footer>
            </>
          ) : null}
        </section>
      </div>

      {error && (
        <div
          className="nova-inbox__error"
          role="alert"
        >
          {error}

          <button
            type="button"
            onClick={() => {
              setError(null);
            }}
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}