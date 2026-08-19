import {
  NOVA_API_URL,
  authFetch,
} from '../auth/auth';

async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  const data: unknown =
    await response
      .json()
      .catch(
        () => null,
      );

  if (
    typeof data ===
      'object' &&
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
      Array.isArray(
        message,
      ) &&
      message.every(
        (
          item,
        ) =>
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
  if (
    response.ok
  ) {
    return;
  }

  throw new Error(
    await getErrorMessage(
      response,
      fallbackMessage,
    ),
  );
}

export type PlatformWorkspace = {
  id: string;
  name: string;
  slug: string;

  status:
    | 'ACTIVE'
    | 'INACTIVE';

  createdAt: string;
  updatedAt: string;

  userCount: number;
};

type WorkspaceResponse = {
  id: string;
  name: string;
  slug: string;

  status:
    | 'ACTIVE'
    | 'INACTIVE';

  createdAt: string;
  updatedAt: string;
};

export type CreatedOwner = {
  id: string;
  username: string;

  role: 'OWNER';

  workspaceId: string;
  siteId: string | null;

  password: string;
};

export async function getPlatformWorkspaces(
  accessToken: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces`,
      {
        method:
          'GET',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudieron cargar los workspaces',
  );

  return (
    await response.json()
  ) as PlatformWorkspace[];
}

export async function createPlatformWorkspace(
  accessToken: string,
  name: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            name,
          }),
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo crear el workspace',
  );

  const workspace = (
    await response.json()
  ) as WorkspaceResponse;

  return {
    ...workspace,

    userCount:
      0,
  } satisfies PlatformWorkspace;
}

export async function activatePlatformWorkspace(
  accessToken: string,
  workspaceId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/activate`,
      {
        method:
          'PATCH',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo activar el workspace',
  );

  return (
    await response.json()
  ) as WorkspaceResponse;
}

export async function deactivatePlatformWorkspace(
  accessToken: string,
  workspaceId: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/deactivate`,
      {
        method:
          'PATCH',
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo desactivar el workspace',
  );

  return (
    await response.json()
  ) as WorkspaceResponse;
}

export async function createWorkspaceOwner(
  accessToken: string,
  workspaceId: string,
  username: string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/workspaces/${workspaceId}/owners`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            username,
          }),
      },
      accessToken,
    );

  await ensureOk(
    response,
    'No se pudo crear el owner',
  );

  return (
    await response.json()
  ) as CreatedOwner;
}