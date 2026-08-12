import { io } from 'socket.io-client';

export const NOVA_API_URL =
  'http://localhost:3000';

export const NOVA_WORKSPACE_SLUG =
  'empresa-demo-nueva';

const visitorTokenKey =
  `nova:visitorToken:${NOVA_WORKSPACE_SLUG}`;

export type NovaConversation = {
  id: string;
  status: 'OPEN' | 'PENDING' | 'CLOSED';
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
  senderType: 'VISITOR' | 'USER';
  senderUserId: string | null;
  senderVisitorId: string | null;
  type: 'TEXT' | 'IMAGE';
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

let visitorPromise:
  Promise<string> | null = null;

let sessionPromise:
  Promise<NovaSession> | null = null;

async function createVisitor() {
  const response = await fetch(
    `${NOVA_API_URL}/widget/${NOVA_WORKSPACE_SLUG}/visitors`,
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
    await response.json() as CreateVisitorResponse;

  localStorage.setItem(
    visitorTokenKey,
    data.visitorToken,
  );

  return data.visitorToken;
}

async function getVisitorToken() {
  const storedToken =
    localStorage.getItem(
      visitorTokenKey,
    );

  if (storedToken) {
    return storedToken;
  }

  if (!visitorPromise) {
    visitorPromise =
      createVisitor().finally(() => {
        visitorPromise = null;
      });
  }

  return visitorPromise;
}

async function getConversation(
  visitorToken: string,
) {
  return fetch(
    `${NOVA_API_URL}/widget/${NOVA_WORKSPACE_SLUG}/conversations`,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${visitorToken}`,
      },
    },
  );
}

async function createSession(): Promise<NovaSession> {
  let visitorToken =
    await getVisitorToken();

  let response =
    await getConversation(
      visitorToken,
    );

  /*
   * Si el token guardado expiró,
   * creamos un Visitor nuevo.
   */
  if (response.status === 401) {
    localStorage.removeItem(
      visitorTokenKey,
    );

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
    await response.json() as NovaConversation;

  return {
    visitorToken,
    conversation,
  };
}

export function getNovaSession() {
  if (!sessionPromise) {
    sessionPromise =
      createSession().catch(
        (error) => {
          sessionPromise = null;
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
  const response = await fetch(
    `${NOVA_API_URL}/widget/${NOVA_WORKSPACE_SLUG}/conversations/${conversationId}/messages`,
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

  return await response.json() as NovaMessage[];
}

export async function sendNovaTextMessage(
  visitorToken: string,
  conversationId: string,
  content: string,
) {
  const response = await fetch(
    `${NOVA_API_URL}/widget/${NOVA_WORKSPACE_SLUG}/conversations/${conversationId}/messages`,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${visitorToken}`,

        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        content,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `No se pudo enviar el mensaje (${response.status})`,
    );
  }

  return await response.json() as NovaMessage;
}

export function connectNovaSocket(
  visitorToken: string,
  conversationId: string,
  handlers: SocketHandlers = {},
) {
  const socket =
    io(NOVA_API_URL, {
      autoConnect: false,

      auth: {
        visitorToken,
      },
    });

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
          workspaceSlug:
            NOVA_WORKSPACE_SLUG,

          conversationId,
        },
      );
    },
  );

  socket.on(
    'conversation:joined',
    (data) => {
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
      message: NovaMessage,
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
    (error) => {
      console.error(
        'Error Socket Nova:',
        error,
      );

      handlers.onError?.(
        error?.message ??
          'Error de Socket',
      );
    },
  );

  socket.on(
    'connect_error',
    (error) => {
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