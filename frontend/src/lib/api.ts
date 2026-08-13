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