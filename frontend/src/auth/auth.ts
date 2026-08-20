export const NOVA_API_URL =
  'http://localhost:3000';

const ACCESS_TOKEN_KEY =
  'nova:accessToken';

const ACCESS_TOKEN_REFRESH_MARGIN_SECONDS =
  30;

export type UserRole =
  | 'PLATFORM_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'AGENT';

export type OwnerType =
  | 'PERMANENT'
  | 'TEMPORARY';

export type AuthUser = {
  userId: string;
  username: string;
  role: UserRole;

  ownerType:
    OwnerType | null;

  workspaceId:
    string | null;

  workspaceSlug:
    string | null;

  mustChangePassword:
    boolean;
};

type LoginResponse = {
  accessToken: string;
};

type LoginInput = {
  username: string;
  password: string;
  workspaceSlug?: string;
};

type JwtPayload = {
  exp?: unknown;
};

type AccessTokenListener = (
  accessToken:
    string | null,
) => void;

const accessTokenListeners =
  new Set<
    AccessTokenListener
  >();

let refreshPromise:
  Promise<string> | null =
    null;

async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  const data:
    unknown =
      await response
        .json()
        .catch(
          () => null,
        );

  if (
    typeof data ===
      'object' &&
    data !==
      null &&
    'message' in
      data
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

function notifyAccessTokenListeners(
  accessToken:
    string | null,
) {
  for (
    const listener
    of accessTokenListeners
  ) {
    listener(
      accessToken,
    );
  }
}

export function saveAccessToken(
  accessToken: string,
) {
  const previousAccessToken =
    localStorage.getItem(
      ACCESS_TOKEN_KEY,
    );

  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    accessToken,
  );

  if (
    previousAccessToken !==
    accessToken
  ) {
    notifyAccessTokenListeners(
      accessToken,
    );
  }
}

export function getStoredAccessToken() {
  return localStorage.getItem(
    ACCESS_TOKEN_KEY,
  );
}

export function clearAccessToken() {
  const hadAccessToken =
    localStorage.getItem(
      ACCESS_TOKEN_KEY,
    ) !==
    null;

  localStorage.removeItem(
    ACCESS_TOKEN_KEY,
  );

  if (
    hadAccessToken
  ) {
    notifyAccessTokenListeners(
      null,
    );
  }
}

export function subscribeAccessTokenChange(
  listener:
    AccessTokenListener,
) {
  accessTokenListeners.add(
    listener,
  );

  return () => {
    accessTokenListeners.delete(
      listener,
    );
  };
}

function getJwtExpiration(
  accessToken: string,
) {
  const parts =
    accessToken.split(
      '.',
    );

  if (
    parts.length !==
    3
  ) {
    return null;
  }

  try {
    const base64Url =
      parts[1];

    const base64 =
      base64Url
        .replace(
          /-/g,
          '+',
        )
        .replace(
          /_/g,
          '/',
        );

    const paddedBase64 =
      base64.padEnd(
        Math.ceil(
          base64.length /
            4,
        ) * 4,

        '=',
      );

    const json =
      atob(
        paddedBase64,
      );

    const payload =
      JSON.parse(
        json,
      ) as unknown;

    if (
      typeof payload !==
        'object' ||
      payload ===
        null
    ) {
      return null;
    }

    const exp = (
      payload as
        JwtPayload
    ).exp;

    if (
      typeof exp !==
      'number'
    ) {
      return null;
    }

    return exp;
  } catch {
    return null;
  }
}

function shouldRefreshAccessToken(
  accessToken: string,
) {
  const expiration =
    getJwtExpiration(
      accessToken,
    );

  if (
    expiration ===
    null
  ) {
    return true;
  }

  const currentTimeSeconds =
    Math.floor(
      Date.now() /
        1000,
    );

  return (
    expiration -
      currentTimeSeconds <=
    ACCESS_TOKEN_REFRESH_MARGIN_SECONDS
  );
}

async function executeRefresh() {
  const response =
    await fetch(
      `${NOVA_API_URL}/auth/refresh`,
      {
        method:
          'POST',

        credentials:
          'include',
      },
    );

  if (
    !response.ok
  ) {
    clearAccessToken();

    throw new Error(
      await getErrorMessage(
        response,
        'La sesión ha expirado',
      ),
    );
  }

  const data = (
    await response.json()
  ) as LoginResponse;

  saveAccessToken(
    data.accessToken,
  );

  return data.accessToken;
}

export function refreshAccessToken() {
  if (
    !refreshPromise
  ) {
    refreshPromise =
      executeRefresh()
        .finally(
          () => {
            refreshPromise =
              null;
          },
        );
  }

  return refreshPromise;
}

export async function getValidAccessToken(
  preferredAccessToken?:
    string,
) {
  const storedAccessToken =
    getStoredAccessToken();

  const accessToken =
    storedAccessToken ??
    preferredAccessToken;

  if (
    accessToken &&
    !shouldRefreshAccessToken(
      accessToken,
    )
  ) {
    if (
      storedAccessToken !==
      accessToken
    ) {
      saveAccessToken(
        accessToken,
      );
    }

    return accessToken;
  }

  return refreshAccessToken();
}

async function fetchWithAccessToken(
  input:
    RequestInfo | URL,

  init:
    RequestInit,

  accessToken:
    string,
) {
  const headers =
    new Headers(
      init.headers,
    );

  headers.set(
    'Authorization',
    `Bearer ${accessToken}`,
  );

  return fetch(
    input,
    {
      ...init,

      headers,

      credentials:
        init.credentials ??
        'include',
    },
  );
}

export async function authFetch(
  input:
    RequestInfo | URL,

  init:
    RequestInit = {},

  preferredAccessToken?:
    string,
) {
  const accessToken =
    await getValidAccessToken(
      preferredAccessToken,
    );

  let response =
    await fetchWithAccessToken(
      input,
      init,
      accessToken,
    );

  if (
    response.status !==
    401
  ) {
    return response;
  }

  /*
   * Puede ocurrir que el token
   * haya sido invalidado justo
   * después de comprobarlo.
   *
   * Intentamos un refresh una
   * sola vez.
   */
  try {
    const newAccessToken =
      await refreshAccessToken();

    response =
      await fetchWithAccessToken(
        input,
        init,
        newAccessToken,
      );
  } catch {
    /*
     * refreshAccessToken ya
     * limpió el access token
     * local.
     *
     * Conservamos la respuesta
     * original para que el caller
     * maneje el 401.
     */
  }

  return response;
}

export async function login(
  input:
    LoginInput,
) {
  const body: {
    username: string;
    password: string;
    workspaceSlug?: string;
  } = {
    username:
      input.username,

    password:
      input.password,
  };

  const workspaceSlug =
    input.workspaceSlug
      ?.trim();

  if (
    workspaceSlug
  ) {
    body.workspaceSlug =
      workspaceSlug;
  }

  const response =
    await fetch(
      `${NOVA_API_URL}/auth/login`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        credentials:
          'include',

        body:
          JSON.stringify(
            body,
          ),
      },
    );

  if (
    !response.ok
  ) {
    throw new Error(
      await getErrorMessage(
        response,
        'No se pudo iniciar sesión',
      ),
    );
  }

  return (
    await response.json()
  ) as LoginResponse;
}

export async function getMe(
  accessToken:
    string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/auth/me`,
      {
        method:
          'GET',
      },

      accessToken,
    );

  if (
    !response.ok
  ) {
    throw new Error(
      await getErrorMessage(
        response,
        'La sesión no es válida',
      ),
    );
  }

  return (
    await response.json()
  ) as AuthUser;
}

export async function changePassword(
  accessToken:
    string,

  newPassword:
    string,
) {
  const response =
    await authFetch(
      `${NOVA_API_URL}/auth/change-password`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            newPassword,
          }),
      },

      accessToken,
    );

  if (
    !response.ok
  ) {
    throw new Error(
      await getErrorMessage(
        response,
        'No se pudo cambiar la contraseña',
      ),
    );
  }

  return (
    await response.json()
  ) as {
    message: string;
  };
}

export async function logout() {
  try {
    await fetch(
      `${NOVA_API_URL}/auth/logout`,
      {
        method:
          'POST',

        credentials:
          'include',
      },
    );
  } finally {
    clearAccessToken();
  }
}

if (
  typeof window !==
  'undefined'
) {
  window.addEventListener(
    'storage',
    (
      event,
    ) => {
      if (
        event.key !==
        ACCESS_TOKEN_KEY
      ) {
        return;
      }

      notifyAccessTokenListeners(
        event.newValue,
      );
    },
  );
}