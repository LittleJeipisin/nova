import {
  io,
} from 'socket.io-client';

import type {
  Socket,
} from 'socket.io-client';

import {
  NOVA_API_URL,
  getValidAccessToken,
  subscribeAccessTokenChange,
} from '../auth/auth';

import type {
  ChatMessage,
  ConversationSummary,
} from '../types/chat';

type AgentSocketHandlers = {
  onWorkspaceJoined?: () => void;

  onConversationJoined?: (
    conversationId: string,
  ) => void;

  onMessage?: (
    message: ChatMessage,
  ) => void;

  onConversationUpdated?: (
    conversation: ConversationSummary,
  ) => void;

  onConversationRemoved?: (
    conversationId: string,
  ) => void;

  onDisconnect?: () => void;

  onError?: (
    message: string,
  ) => void;
};

type ConversationJoinedResponse = {
  conversationId?: string;
};

type SelectedConversation = {
  workspaceId: string;
  conversationId: string;
};

const selectedConversationBySocket =
  new WeakMap<
    Socket,
    SelectedConversation
  >();

function getSocketErrorMessage(
  error: unknown,
) {
  if (
    typeof error ===
      'object' &&
    error !== null &&
    'message' in error
  ) {
    const message = (
      error as {
        message?: unknown;
      }
    ).message;

    if (
      typeof message ===
      'string'
    ) {
      return message;
    }
  }

  return 'Error de Socket';
}

function getRemovedConversationId(
  data: unknown,
) {
  if (
    typeof data ===
    'string'
  ) {
    return data;
  }

  if (
    typeof data ===
      'object' &&
    data !== null &&
    'conversationId' in data
  ) {
    const conversationId = (
      data as {
        conversationId?: unknown;
      }
    ).conversationId;

    if (
      typeof conversationId ===
      'string'
    ) {
      return conversationId;
    }
  }

  return null;
}

export function connectAgentSocket(
  accessToken: string,
  workspaceId: string,
  handlers:
    AgentSocketHandlers = {},
) {
  const socket =
    io(
      NOVA_API_URL,
      {
        autoConnect:
          false,

        auth: {
          token:
            accessToken,
        },
      },
    );

  let currentAccessToken =
    accessToken;

  let started =
    false;

  let disposed =
    false;

  let reconnectingForToken =
    false;

  const reconnectWithToken = (
    newAccessToken: string,
  ) => {
    if (
      disposed ||
      newAccessToken ===
        currentAccessToken
    ) {
      return;
    }

    currentAccessToken =
      newAccessToken;

    socket.auth = {
      token:
        newAccessToken,
    };

    if (!started) {
      return;
    }

    if (socket.connected) {
      reconnectingForToken =
        true;

      socket.disconnect();
      socket.connect();

      return;
    }

    socket.connect();
  };

  const unsubscribeAccessToken =
    subscribeAccessTokenChange(
      (
        newAccessToken,
      ) => {
        if (
          disposed
        ) {
          return;
        }

        if (!newAccessToken) {
          disposed =
            true;

          selectedConversationBySocket.delete(
            socket,
          );

          unsubscribeAccessToken();

          if (
            socket.connected
          ) {
            socket.disconnect();
          }

          return;
        }

        reconnectWithToken(
          newAccessToken,
        );
      },
    );

  socket.on(
    'connect',
    () => {
      const connectionId =
        socket.id;

      console.log(
        'Nova Agent Socket conectado:',
        connectionId,
      );

      void getValidAccessToken(
        currentAccessToken,
      )
        .then(
          (
            validAccessToken,
          ) => {
            if (
              disposed ||
              !socket.connected ||
              socket.id !==
                connectionId
            ) {
              return;
            }

            if (
              validAccessToken !==
              currentAccessToken
            ) {
              reconnectWithToken(
                validAccessToken,
              );

              return;
            }

            reconnectingForToken =
              false;

            socket.emit(
              'workspace:join',
              {
                workspaceId,
              },
            );
          },
        )
        .catch(
          (
            error: unknown,
          ) => {
            const message =
              getSocketErrorMessage(
                error,
              );

            console.error(
              'No se pudo renovar la sesión del Socket:',
              message,
            );

            handlers.onError?.(
              message,
            );
          },
        );
    },
  );

  socket.on(
    'workspace:joined',
    () => {
      handlers.onWorkspaceJoined?.();

      /*
       * Si el socket tuvo que reconectarse
       * por renovación del token, volvemos
       * a entrar al chat que estaba abierto.
       */
      const selectedConversation =
        selectedConversationBySocket.get(
          socket,
        );

      if (
        selectedConversation &&
        selectedConversation.workspaceId ===
          workspaceId
      ) {
        socket.emit(
          'conversation:join:agent',
          selectedConversation,
        );
      }
    },
  );

  socket.on(
    'conversation:joined',
    (
      data:
        ConversationJoinedResponse,
    ) => {
      if (
        typeof data
          ?.conversationId ===
        'string'
      ) {
        handlers
          .onConversationJoined?.(
            data.conversationId,
          );
      }
    },
  );

  socket.on(
    'message:new',
    (
      message:
        ChatMessage,
    ) => {
      handlers.onMessage?.(
        message,
      );
    },
  );

  socket.on(
    'conversation:updated',
    (
      conversation:
        ConversationSummary,
    ) => {
      handlers
        .onConversationUpdated?.(
          conversation,
        );
    },
  );

  socket.on(
    'conversation:removed',
    (
      data: unknown,
    ) => {
      const conversationId =
        getRemovedConversationId(
          data,
        );

      if (conversationId) {
        handlers
          .onConversationRemoved?.(
            conversationId,
          );
      }
    },
  );

  socket.on(
    'exception',
    (
      error: unknown,
    ) => {
      const message =
        getSocketErrorMessage(
          error,
        );

      console.error(
        'Error Socket Nova:',
        message,
      );

      handlers.onError?.(
        message,
      );
    },
  );

  socket.on(
    'connect_error',
    (
      error: Error,
    ) => {
      console.error(
        'Error conectando Socket Nova:',
        error.message,
      );

      handlers.onError?.(
        error.message,
      );
    },
  );

  socket.on(
    'disconnect',
    (
      reason,
    ) => {
      if (
        !reconnectingForToken
      ) {
        handlers.onDisconnect?.();
      }

      /*
       * Si el componente hizo socket.disconnect(),
       * eliminamos también la suscripción
       * al cambio de access token.
       */
      if (
        reason ===
          'io client disconnect' &&
        !reconnectingForToken
      ) {
        disposed =
          true;

        selectedConversationBySocket.delete(
          socket,
        );

        unsubscribeAccessToken();
      }
    },
  );

  /*
   * Antes de la primera conexión comprobamos
   * el token. Si está cerca de expirar,
   * obtenemos uno nuevo primero.
   */
  void getValidAccessToken(
    accessToken,
  )
    .then(
      (
        validAccessToken,
      ) => {
        if (disposed) {
          return;
        }

        currentAccessToken =
          validAccessToken;

        socket.auth = {
          token:
            validAccessToken,
        };

        started =
          true;

        socket.connect();
      },
    )
    .catch(
      (
        error: unknown,
      ) => {
        const message =
          getSocketErrorMessage(
            error,
          );

        console.error(
          'No se pudo iniciar el Socket Nova:',
          message,
        );

        handlers.onError?.(
          message,
        );
      },
    );

  return socket;
}

export function joinAgentConversation(
  socket: Socket,
  workspaceId: string,
  conversationId: string,
) {
  const selectedConversation = {
    workspaceId,
    conversationId,
  };

  selectedConversationBySocket.set(
    socket,
    selectedConversation,
  );

  socket.emit(
    'conversation:join:agent',
    selectedConversation,
  );
}