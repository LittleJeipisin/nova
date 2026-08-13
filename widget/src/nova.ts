import { io } from 'socket.io-client';

export const NOVA_API_URL = 'http://localhost:3000';

const workspaceParam = new URLSearchParams(
  window.location.search,
)
  .get('workspace')
  ?.trim();

export const NOVA_WORKSPACE_SLUG =
  workspaceParam ?? '';

export type NovaWidgetPosition =
  | 'LEFT'
  | 'RIGHT';

export type NovaWidgetConfig = {
  title: string;
  subtitle: string;
  welcomeMessage: string;
  position: NovaWidgetPosition;
};

export type NovaConversation = {
  id: string;
  status:
    | 'OPEN'
    | 'PENDING'
    | 'CLOSED';
  workspaceId: string;
  visitorId: string;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export type NovaMessage = {
  id: string;
  conversationId: string;
  senderType:
    | 'VISITOR'
    | 'USER';
  senderUserId: string | null;
  senderVisitorId: string | null;
  type:
    | 'TEXT'
    | 'IMAGE';
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

type CreateVisitorResponse = {
  visitorId: string;
  visitorToken: string;

  visitor: {
    id: string;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
    lastSeenAt: string;
  };
};

type ActiveConversationResponse = {
  conversation: NovaConversation | null;
};

export type NovaSession = {
  visitorToken: string;
  conversation: NovaConversation;
};

type SocketHandlers = {
  onJoined?: () => void;

  onMessage?: (
    message: NovaMessage,
  ) => void;

  onDisconnect?: () => void;

  onError?: (
    message: string,
  ) => void;
};

let configPromise:
  Promise<NovaWidgetConfig> | null = null;

let visitorPromise:
  Promise<string> | null = null;

let sessionPromise:
  Promise<NovaSession> | null = null;

let restorePromise:
  Promise<NovaSession | null> | null = null;

function getWorkspaceSlug() {
  if (!NOVA_WORKSPACE_SLUG) {
    throw new Error(
      'Falta el parámetro ?workspace= en la URL',
    );
  }

  return NOVA_WORKSPACE_SLUG;
}

function getEncodedWorkspaceSlug() {
  return encodeURIComponent(
    getWorkspaceSlug(),
  );
}

function getVisitorTokenKey() {
  return `nova:visitorToken:${getWorkspaceSlug()}`;
}

function getStoredVisitorToken() {
  return localStorage.getItem(
    getVisitorTokenKey(),
  );
}

function removeStoredVisitorToken() {
  localStorage.removeItem(
    getVisitorTokenKey(),
  );
}

async function loadNovaConfig() {
  const workspaceSlug =
    getEncodedWorkspaceSlug();

  const response =
    await fetch(
      `${NOVA_API_URL}/widget/${workspaceSlug}/config`,
      {
        method: 'GET',
      },
    );

  if (!response.ok) {
    throw new Error(
      `Widget no disponible (${response.status})`,
    );
  }

  return (
    await response.json()
  ) as NovaWidgetConfig;
}

export function getNovaConfig() {
  if (!configPromise) {
    configPromise =
      loadNovaConfig()
        .catch(
          (
            error: unknown,
          ) => {
            configPromise =
              null;

            throw error;
          },
        );
  }

  return configPromise;
}

async function createVisitor() {
  const workspaceSlug =
    getEncodedWorkspaceSlug();

  const response =
    await fetch(
      `${NOVA_API_URL}/widget/${workspaceSlug}/visitors`,
      {
        method: 'POST',
      },
    );

  if (!response.ok) {
    throw new Error(
      `No se pudo crear el Visitor (${response.status})`,
    );
  }

  const data =
    (
      await response.json()
    ) as CreateVisitorResponse;

  localStorage.setItem(
    getVisitorTokenKey(),
    data.visitorToken,
  );

  return data.visitorToken;
}

async function getVisitorToken() {
  const storedToken =
    getStoredVisitorToken();

  if (storedToken) {
    return storedToken;
  }

  if (!visitorPromise) {
    visitorPromise =
      createVisitor()
        .finally(
          () => {
            visitorPromise =
              null;
          },
        );
  }

  return visitorPromise;
}

async function getConversation(
  visitorToken: string,
) {
  const workspaceSlug =
    getEncodedWorkspaceSlug();

  return fetch(
    `${NOVA_API_URL}/widget/${workspaceSlug}/conversations`,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${visitorToken}`,
      },
    },
  );
}

async function getActiveConversation(
  visitorToken: string,
) {
  const workspaceSlug =
    getEncodedWorkspaceSlug();

  return fetch(
    `${NOVA_API_URL}/widget/${workspaceSlug}/conversations/active`,
    {
      method: 'GET',

      headers: {
        Authorization:
          `Bearer ${visitorToken}`,
      },
    },
  );
}

/*
 * Restaura únicamente una conversación
 * que YA existe y YA tiene mensajes.
 *
 * No crea Visitor.
 * No crea Conversation.
 */
async function restoreSession():
  Promise<NovaSession | null> {
  const visitorToken =
    getStoredVisitorToken();

  if (!visitorToken) {
    return null;
  }

  const response =
    await getActiveConversation(
      visitorToken,
    );

  /*
   * Si el visitorToken expiró o dejó
   * de ser válido, lo olvidamos.
   *
   * Tampoco creamos Visitor nuevo aquí.
   * Eso ocurrirá cuando realmente
   * intente enviar un mensaje.
   */
  if (
    response.status ===
    401
  ) {
    removeStoredVisitorToken();

    return null;
  }

  if (!response.ok) {
    throw new Error(
      `No se pudo recuperar la conversación (${response.status})`,
    );
  }

  const data =
    (
      await response.json()
    ) as ActiveConversationResponse;

  if (!data.conversation) {
    return null;
  }

  return {
    visitorToken,
    conversation:
      data.conversation,
  };
}

export function restoreNovaSession() {
  if (!restorePromise) {
    restorePromise =
      restoreSession()
        .catch(
          (
            error: unknown,
          ) => {
            restorePromise =
              null;

            throw error;
          },
        );
  }

  return restorePromise;
}

/*
 * Este flujo SÍ puede crear:
 *
 * Visitor
 * Conversation
 *
 * Solamente debe usarse cuando el
 * visitante realmente intenta enviar.
 */
async function createSession():
  Promise<NovaSession> {
  let visitorToken =
    await getVisitorToken();

  let response =
    await getConversation(
      visitorToken,
    );

  if (
    response.status ===
    401
  ) {
    removeStoredVisitorToken();

    visitorToken =
      await createVisitor();

    response =
      await getConversation(
        visitorToken,
      );
  }

  if (!response.ok) {
    throw new Error(
      `No se pudo crear la conversación (${response.status})`,
    );
  }

  const conversation =
    (
      await response.json()
    ) as NovaConversation;

  return {
    visitorToken,
    conversation,
  };
}

export function getNovaSession() {
  if (!sessionPromise) {
    sessionPromise =
      createSession()
        .catch(
          (
            error: unknown,
          ) => {
            sessionPromise =
              null;

            throw error;
          },
        );
  }

  return sessionPromise;
}

export async function getNovaMessages(
  visitorToken: string,
  conversationId: string,
) {
  const workspaceSlug =
    getEncodedWorkspaceSlug();

  const response =
    await fetch(
      `${NOVA_API_URL}/widget/${workspaceSlug}/conversations/${conversationId}/messages`,
      {
        method: 'GET',

        headers: {
          Authorization:
            `Bearer ${visitorToken}`,
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      `No se pudo cargar el historial (${response.status})`,
    );
  }

  return (
    await response.json()
  ) as NovaMessage[];
}

export async function sendNovaTextMessage(
  visitorToken: string,
  conversationId: string,
  content: string,
) {
  const workspaceSlug =
    getEncodedWorkspaceSlug();

  const response =
    await fetch(
      `${NOVA_API_URL}/widget/${workspaceSlug}/conversations/${conversationId}/messages`,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${visitorToken}`,

          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            content,
          }),
      },
    );

  if (!response.ok) {
    throw new Error(
      `No se pudo enviar el mensaje (${response.status})`,
    );
  }

  return (
    await response.json()
  ) as NovaMessage;
}

export async function sendNovaImageMessage(
  visitorToken: string,
  conversationId: string,
  file: File,
  content?: string,
) {
  const workspaceSlug =
    getEncodedWorkspaceSlug();

  const formData =
    new FormData();

  formData.append(
    'file',
    file,
  );

  if (content?.trim()) {
    formData.append(
      'content',
      content.trim(),
    );
  }

  const response =
    await fetch(
      `${NOVA_API_URL}/widget/${workspaceSlug}/conversations/${conversationId}/images`,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${visitorToken}`,
        },

        body:
          formData,
      },
    );

  if (!response.ok) {
    throw new Error(
      `No se pudo enviar la imagen (${response.status})`,
    );
  }

  return (
    await response.json()
  ) as NovaMessage;
}

function getSocketErrorMessage(
  error: unknown,
) {
  if (
    typeof error ===
      'object' &&
    error !== null &&
    'message' in error
  ) {
    const message =
      error.message;

    if (
      typeof message ===
      'string'
    ) {
      return message;
    }
  }

  return 'Error de Socket';
}

export function connectNovaSocket(
  visitorToken: string,
  conversationId: string,
  handlers:
    SocketHandlers = {},
) {
  const workspaceSlug =
    getWorkspaceSlug();

  const socket =
    io(
      NOVA_API_URL,
      {
        autoConnect:
          false,

        auth: {
          visitorToken,
        },
      },
    );

  socket.on(
    'connect',
    () => {
      console.log(
        'Nova Socket conectado:',
        socket.id,
      );

      socket.emit(
        'conversation:join:visitor',
        {
          workspaceSlug,
          conversationId,
        },
      );
    },
  );

  socket.on(
    'conversation:joined',
    (
      data: unknown,
    ) => {
      console.log(
        'Visitor unido a conversación:',
        data,
      );

      handlers.onJoined?.();
    },
  );

  socket.on(
    'message:new',
    (
      message:
        NovaMessage,
    ) => {
      console.log(
        'Mensaje realtime:',
        message,
      );

      handlers.onMessage?.(
        message,
      );
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
        'Error de conexión Socket:',
        error.message,
      );

      handlers.onError?.(
        error.message,
      );
    },
  );

  socket.on(
    'disconnect',
    () => {
      handlers.onDisconnect?.();
    },
  );

  socket.connect();

  return socket;
}