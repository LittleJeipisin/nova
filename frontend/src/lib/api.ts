import {
  NOVA_API_URL,
  authFetch,
} from '../auth/auth';

import type {
  ChatMessage,
  ConversationDetail,
  ConversationStatus,
  ConversationSummary,
} from '../types/chat';

async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  const data: unknown =
    await response
      .json()
      .catch(() => null);

  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data
  ) {
    const message = (
      data as {
        message?: unknown;
      }
    ).message;

    if (
      typeof message ===
      'string'
    ) {
      return message;
    }

    if (
      Array.isArray(message) &&
      message.every(
        (item) =>
          typeof item ===
          'string',
      )
    ) {
      return message.join(
        ', ',
      );
    }
  }

  return fallbackMessage;
}

async function ensureOk(
  response: Response,
  fallbackMessage: string,
) {
  if (response.ok) {
    return;
  }

  throw new Error(
    await getErrorMessage(
      response,
      fallbackMessage,
    ),
  );
}

export async function getConversations(
  accessToken: string,
  workspaceId: string,
  status?: ConversationStatus,
) {
  const searchParams =
    new URLSearchParams();

  if (status) {
    searchParams.set(
      'status',
      status,
    );
  }

  const query =
    searchParams.size > 0
      ? `?${searchParams.toString()}`
      : '';

  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/conversations${query}`,
      {
        method: 'GET',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudieron cargar las conversaciones',
  );

  return (
    await response.json()
  ) as ConversationSummary[];
}

export async function getConversation(
  accessToken: string,
  workspaceId: string,
  conversationId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/conversations/${conversationId}`,
      {
        method: 'GET',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo cargar la conversación',
  );

  return (
    await response.json()
  ) as ConversationDetail;
}

export async function claimConversation(
  accessToken: string,
  workspaceId: string,
  conversationId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/conversations/${conversationId}/claim`,
      {
        method: 'PATCH',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo tomar la conversación',
  );

  return (
    await response.json()
  ) as ConversationSummary;
}

export async function sendAgentTextMessage(
  accessToken: string,
  workspaceId: string,
  conversationId: string,
  content: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            content,
          }),
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo enviar el mensaje',
  );

  return (
    await response.json()
  ) as ChatMessage;
}

export async function sendAgentImageMessage(
  accessToken: string,
  workspaceId: string,
  conversationId: string,
  file: File,
  content?: string,
) {
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
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/conversations/${conversationId}/images`,
      {
        method: 'POST',

        body:
          formData,
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo enviar la imagen',
  );

  return (
    await response.json()
  ) as ChatMessage;
}

export async function updateConversationStatus(
  accessToken: string,
  workspaceId: string,
  conversationId: string,
  status: 'OPEN' | 'PENDING',
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/conversations/${conversationId}/status`,
      {
        method: 'PATCH',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            status,
          }),
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo cambiar el estado de la conversación',
  );

  return (
    await response.json()
  ) as ConversationSummary;
}

export async function closeConversation(
  accessToken: string,
  workspaceId: string,
  conversationId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/conversations/${conversationId}/close`,
      {
        method: 'PATCH',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo cerrar la conversación',
  );

  return (
    await response.json()
  ) as ConversationSummary;
}

export async function assignConversation(
  accessToken: string,
  workspaceId: string,
  conversationId: string,
  agentId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/conversations/${conversationId}/assign`,
      {
        method: 'PATCH',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            agentId,
          }),
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo asignar la conversación',
  );

  return (
    await response.json()
  ) as ConversationSummary;
}

export type Site = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  domain: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
};

export async function getSites(
  accessToken: string,
  workspaceId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/sites`,
      {
        method: 'GET',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudieron cargar las páginas',
  );

  return (
    await response.json()
  ) as Site[];
}

export async function createSite(
  accessToken: string,
  workspaceId: string,
  data: {
    name: string;
    slug?: string;
    domain?: string;
  },
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/sites`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify(data),
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo crear la página',
  );

  return (
    await response.json()
  ) as Site;
}

export async function deactivateSite(
  accessToken: string,
  workspaceId: string,
  siteId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/sites/${siteId}/deactivate`,
      {
        method: 'PATCH',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo desactivar la página',
  );

  return (
    await response.json()
  ) as Site;
}

export async function activateSite(
  accessToken: string,
  workspaceId: string,
  siteId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/sites/${siteId}/activate`,
      {
        method: 'PATCH',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo reactivar la página',
  );

  return (
    await response.json()
  ) as Site;
}

export type WorkspaceUser = {
  id: string;
  username: string;
  role:
    | 'PLATFORM_ADMIN'
    | 'OWNER'
    | 'ADMIN'
    | 'AGENT';
  status: 'ACTIVE' | 'INACTIVE';
  ownerType: string | null;
  expiresAt: string | null;
  workspaceId: string | null;
  siteId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getWorkspaceUsers(
  accessToken: string,
  workspaceId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/users`,
      {
        method: 'GET',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudieron cargar los usuarios',
  );

  return (
    await response.json()
  ) as WorkspaceUser[];
}

export type CreatedWorkspaceUser = {
  id: string;
  username: string;
  role: string;
  workspaceId: string | null;
  siteId: string | null;
  password: string;
};

export async function createAgent(
  accessToken: string,
  workspaceId: string,
  username: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/agents`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          username,
        }),
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo crear el agente',
  );

  return (
    await response.json()
  ) as CreatedWorkspaceUser;
}

export async function createAdmin(
  accessToken: string,
  workspaceId: string,
  username: string,
  siteId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/admins`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          username,
          siteId,
        }),
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo crear el administrador',
  );

  return (
    await response.json()
  ) as CreatedWorkspaceUser;
}

export async function deactivateWorkspaceUser(
  accessToken: string,
  workspaceId: string,
  userId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/users/${userId}/deactivate`,
      {
        method: 'PATCH',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo desactivar el usuario',
  );

  return (
    await response.json()
  ) as WorkspaceUser;
}

export async function activateWorkspaceUser(
  accessToken: string,
  workspaceId: string,
  userId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/users/${userId}/activate`,
      {
        method: 'PATCH',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo reactivar el usuario',
  );

  return (
    await response.json()
  ) as WorkspaceUser;
}