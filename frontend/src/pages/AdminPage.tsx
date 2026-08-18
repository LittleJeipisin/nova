import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  NOVA_API_URL,
  getStoredAccessToken,
  getValidAccessToken,
} from '../auth/auth';

import type {
  AuthUser,
} from '../auth/auth';

import type {
  SyntheticEvent,
} from 'react';

import {
  activateSite,
  activateWorkspaceUser,
  assignConversation,
  createAdmin,
  createAgent,
  createSite,
  deactivateSite,
  deactivateWorkspaceUser,
  getConversation,
  getConversations,
  getSites,
  getWorkspaceUsers,
} from '../lib/api';

import type {
  Site,
  WorkspaceUser,
} from '../lib/api';

import {
  connectAgentSocket,
} from '../lib/socket';

import type {
  ConversationDetail,
  ConversationSummary,
} from '../types/chat';

type AdminPageProps = {
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

async function fetchAdminData(
  workspaceId: string,
) {
  const accessToken =
    await getValidAccessToken(
      getStoredAccessToken() ??
        undefined,
    );

  const [
    conversations,
    users,
    sites,
  ] = await Promise.all([
    getConversations(
      accessToken,
      workspaceId,
    ),

    getWorkspaceUsers(
      accessToken,
      workspaceId,
    ),

    getSites(
      accessToken,
      workspaceId,
    ),
  ]);

  return {
    conversations,
    users,
    sites,
  };
}

export function AdminPage({
  user,
  onLogout,
}: AdminPageProps) {
  const workspaceId =
    user.workspaceId ?? '';
  const activeConversationIdRef =
    useRef<string | null>(
      null,
    );

  const [
    conversations,
    setConversations,
  ] =
    useState<
      ConversationSummary[]
    >([]);

  const [
    activeConversation,
    setActiveConversation,
  ] =
    useState<
      ConversationDetail | null
    >(null);

  const [
    loadingConversation,
    setLoadingConversation,
  ] =
    useState(false);

  const [
    users,
    setUsers,
  ] =
    useState<
      WorkspaceUser[]
    >([]);

  const [
    sites,
    setSites,
  ] =
    useState<
      Site[]
    >([]);

  const [
    selectedAgents,
    setSelectedAgents,
  ] =
    useState<
      Record<string, string>
    >({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    assigningConversationId,
    setAssigningConversationId,
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

const [
  newAgentUsername,
  setNewAgentUsername,
] = useState('');

const [
  creatingAgent,
  setCreatingAgent,
] = useState(false);

const [
  managingUserId,
  setManagingUserId,
] =
  useState<string | null>(
    null,
  );

const [
  createdAgent,
  setCreatedAgent,
] =
  useState<{
    username: string;
    password: string;
  } | null>(null);

const [
  newAdminUsername,
  setNewAdminUsername,
] = useState('');

const [
  selectedAdminSiteId,
  setSelectedAdminSiteId,
] = useState('');

const [
  newSiteName,
  setNewSiteName,
] = useState('');

const [
  newSiteSlug,
  setNewSiteSlug,
] = useState('');

const [
  newSiteDomain,
  setNewSiteDomain,
] = useState('');

const [
  creatingSite,
  setCreatingSite,
] = useState(false);

const [
  managingSiteId,
  setManagingSiteId,
] =
  useState<string | null>(
    null,
  );

const [
  creatingAdmin,
  setCreatingAdmin,
] = useState(false);

const [
  createdAdmin,
  setCreatedAdmin,
] =
  useState<{
    username: string;
    password: string;
  } | null>(null);

  const agents =
    users.filter(
      (workspaceUser) =>
        workspaceUser.role ===
          'AGENT' &&
        workspaceUser.status ===
          'ACTIVE',
    );

const allAgents =
  users.filter(
    (workspaceUser) =>
      workspaceUser.role ===
      'AGENT',
  );

const admins =
  users.filter(
    (workspaceUser) =>
      workspaceUser.role ===
      'ADMIN',
  );

const activeSites =
  sites.filter(
    (site) =>
      site.status ===
      'ACTIVE',
  );

function getSiteName(
  siteId: string | null,
) {
  if (!siteId) {
    return 'Sin página';
  }

  return (
    sites.find(
      (site) =>
        site.id === siteId,
    )?.name ??
    'Página desconocida'
  );
}

useEffect(
  () => {
    activeConversationIdRef.current =
      activeConversation?.id ??
      null;
  },
  [
    activeConversation?.id,
  ],
);

  async function loadData() {
    if (!workspaceId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data =
        await fetchAdminData(
          workspaceId,
        );

      setConversations(
        data.conversations,
      );

      setUsers(
        data.users,
      );

      setSites(
        data.sites,
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la administración',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      if (!workspaceId) {
        return;
      }

      try {
        const data =
          await fetchAdminData(
            workspaceId,
          );

        if (cancelled) {
          return;
        }

        setConversations(
          data.conversations,
        );

        setUsers(
          data.users,
        );

        setSites(
          data.sites,
        );

        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la administración',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(
  () => {
    if (
      !workspaceId ||
      (
        user.role !==
          'OWNER' &&
        user.role !==
          'ADMIN'
      )
    ) {
      return;
    }

    const accessToken =
      getStoredAccessToken() ??
      '';

    if (!accessToken) {
      onLogout();

      return;
    }

    let cancelled =
      false;

    async function syncConversations() {
      try {
        const validAccessToken =
          await getValidAccessToken(
            getStoredAccessToken() ??
              undefined,
          );

        const latestConversations =
          await getConversations(
            validAccessToken,
            workspaceId,
          );

        if (cancelled) {
          return;
        }

        setConversations(
          sortConversations(
            latestConversations,
          ),
        );
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          'No se pudo resincronizar la bandeja administrativa:',
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : 'No se pudieron actualizar las conversaciones',
        );
      }
    }

    async function refreshOpenConversation(
      conversationId: string,
    ) {
      try {
        const validAccessToken =
          await getValidAccessToken(
            getStoredAccessToken() ??
              undefined,
          );

        const conversation =
          await getConversation(
            validAccessToken,
            workspaceId,
            conversationId,
          );

        if (
          cancelled ||
          activeConversationIdRef
            .current !==
            conversationId
        ) {
          return;
        }

        setActiveConversation(
          conversation,
        );
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          'No se pudo actualizar el chat abierto:',
          err,
        );
      }
    }

    const socket =
      connectAgentSocket(
        accessToken,
        workspaceId,
        {
          onWorkspaceJoined() {
            if (cancelled) {
              return;
            }

            /*
             * Socket no es retroactivo.
             *
             * Cada vez que conecta o
             * reconecta, sincronizamos
             * nuevamente mediante REST.
             */
            void syncConversations();
          },

          onConversationUpdated(
            conversation,
          ) {
            if (cancelled) {
              return;
            }

            /*
             * Añadimos una conversación
             * nueva o reemplazamos una
             * existente.
             */
            setConversations(
              (
                currentConversations,
              ) => {
                const withoutCurrent =
                  currentConversations.filter(
                    (
                      current,
                    ) =>
                      current.id !==
                      conversation.id,
                  );

                return sortConversations([
                  conversation,
                  ...withoutCurrent,
                ]);
              },
            );

            /*
             * El evento contiene el resumen.
             *
             * Si tenemos ese chat abierto,
             * pedimos el detalle completo
             * para actualizar también los
             * mensajes.
             */
            if (
              activeConversationIdRef
                .current ===
              conversation.id
            ) {
              void refreshOpenConversation(
                conversation.id,
              );
            }
          },

          onError(
            message,
          ) {
            if (cancelled) {
              return;
            }

            setError(
              message,
            );
          },
        },
      );

    return () => {
      cancelled =
        true;

      socket.disconnect();
    };
  },
  [
    onLogout,
    user.role,
    workspaceId,
  ],
);


  async function handleCreateAdmin(
  event: SyntheticEvent<HTMLFormElement>,
) {
  event.preventDefault();

  const username =
    newAdminUsername.trim();

  if (!username) {
    setError(
      'Escribe un nombre de usuario',
    );

    return;
  }

  if (!selectedAdminSiteId) {
    setError(
      'Selecciona una página para el administrador',
    );

    return;
  }

  try {
    setCreatingAdmin(true);
    setError(null);
    setCreatedAdmin(null);

    const accessToken =
      await getValidAccessToken(
        getStoredAccessToken() ??
          undefined,
      );

    const created =
      await createAdmin(
        accessToken,
        workspaceId,
        username,
        selectedAdminSiteId,
      );

    setCreatedAdmin({
      username:
        created.username,
      password:
        created.password,
    });

    setNewAdminUsername('');
    setSelectedAdminSiteId('');

    await loadData();
  } catch (err) {
    console.error(err);

    setError(
      err instanceof Error
        ? err.message
        : 'No se pudo crear el administrador',
    );
  } finally {
    setCreatingAdmin(false);
  }
}

  async function handleCreateSite(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name =
      newSiteName.trim();

    if (!name) {
      setError(
        'Escribe un nombre para la página',
      );

      return;
    }

    try {
      setCreatingSite(true);
      setError(null);

      const accessToken =
        await getValidAccessToken(
          getStoredAccessToken() ??
            undefined,
        );

      await createSite(
        accessToken,
        workspaceId,
        {
          name,
          slug:
            newSiteSlug.trim() ||
            undefined,
          domain:
            newSiteDomain.trim() ||
            undefined,
        },
      );

      setNewSiteName('');
      setNewSiteSlug('');
      setNewSiteDomain('');

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear la página',
      );
    } finally {
      setCreatingSite(false);
    }
  }

  async function handleSiteStatus(
    site: Site,
  ) {
    try {
      setManagingSiteId(
        site.id,
      );

      setError(null);

      const accessToken =
        await getValidAccessToken(
          getStoredAccessToken() ??
            undefined,
        );

      if (
        site.status ===
        'ACTIVE'
      ) {
        await deactivateSite(
          accessToken,
          workspaceId,
          site.id,
        );
      } else {
        await activateSite(
          accessToken,
          workspaceId,
          site.id,
        );
      }

      if (
        selectedAdminSiteId ===
          site.id &&
        site.status === 'ACTIVE'
      ) {
        setSelectedAdminSiteId('');
      }

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar el estado de la página',
      );
    } finally {
      setManagingSiteId(null);
    }
  }

  async function handleCreateAgent(
  event: SyntheticEvent<HTMLFormElement>,
) {
  event.preventDefault();

  const username =
    newAgentUsername.trim();

  if (!username) {
    setError(
      'Escribe un nombre de usuario',
    );

    return;
  }

  try {
    setCreatingAgent(true);
    setError(null);
    setCreatedAgent(null);

    const accessToken =
      await getValidAccessToken(
        getStoredAccessToken() ??
          undefined,
      );

    const created =
      await createAgent(
        accessToken,
        workspaceId,
        username,
      );

    setCreatedAgent({
      username:
        created.username,
      password:
        created.password,
    });

    setNewAgentUsername('');

    await loadData();
  } catch (err) {
    console.error(err);

    setError(
      err instanceof Error
        ? err.message
        : 'No se pudo crear el agente',
    );
  } finally {
    setCreatingAgent(false);
  }
}

async function handleUserStatus(
  targetUser: WorkspaceUser,
) {
  try {
    setManagingUserId(
      targetUser.id,
    );

    setError(null);

    const accessToken =
      await getValidAccessToken(
        getStoredAccessToken() ??
          undefined,
      );

    if (
      targetUser.status ===
      'ACTIVE'
    ) {
      await deactivateWorkspaceUser(
        accessToken,
        workspaceId,
        targetUser.id,
      );
    } else {
      await activateWorkspaceUser(
        accessToken,
        workspaceId,
        targetUser.id,
      );
    }

    await loadData();
  } catch (err) {
    console.error(err);

    setError(
      err instanceof Error
        ? err.message
        : 'No se pudo cambiar el estado del usuario',
    );
  } finally {
    setManagingUserId(null);
  }
}

  async function handleOpenConversation(
    conversationId: string,
  ) {
    try {
      setLoadingConversation(
        true,
      );

      setError(null);

      const accessToken =
        await getValidAccessToken(
          getStoredAccessToken() ??
            undefined,
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
  }

  async function handleAssign(
    conversation:
      ConversationSummary,
  ) {
    const agentId =
      selectedAgents[
        conversation.id
      ] ??
      conversation.assignedAgentId ??
      '';

    if (!agentId) {
      setError(
        'Selecciona un agente',
      );

      return;
    }

    const selectedAgent =
      users.find(
        (workspaceUser) =>
          workspaceUser.id ===
          agentId,
      );

    const conversationSiteId =
      (
        conversation as ConversationSummary & {
          siteId?: string | null;
        }
      ).siteId ??
      null;

    if (
      conversationSiteId &&
      selectedAgent?.siteId !==
        conversationSiteId
    ) {
      setError(
        'El agente debe pertenecer a la misma página que la conversación',
      );

      return;
    }

    try {
      setAssigningConversationId(
        conversation.id,
      );

      setError(null);

      const accessToken =
        await getValidAccessToken(
          getStoredAccessToken() ??
            undefined,
        );

      await assignConversation(
        accessToken,
        workspaceId,
        conversation.id,
        agentId,
      );

      await loadData();

      if (
        activeConversation?.id ===
        conversation.id
      ) {
        await handleOpenConversation(
          conversation.id,
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo asignar la conversación',
      );
    } finally {
      setAssigningConversationId(
        null,
      );
    }
  }

  if (!workspaceId) {
    return (
      <main className="nova-dashboard">
        Workspace no disponible.
      </main>
    );
  }

  return (
    <main className="nova-dashboard">
      <header className="nova-dashboard__header">
        <div className="nova-dashboard__brand">
          <div className="nova-dashboard__logo">
            N
          </div>

          <strong>
            Nova Administración
          </strong>
        </div>

        <div className="nova-dashboard__user">
          <div>
            <strong>
              {user.username}
            </strong>

            <span>
              {user.role}
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="nova-dashboard__content">
        <div className="nova-dashboard__welcome">
          <div>
            <h1>
              Conversaciones
            </h1>

            <p>
              Visualiza, asigna o
              reasigna conversaciones
              a los agentes del
              workspace.
            </p>

            <button
              type="button"
              onClick={() => {
                void loadData();
              }}
              disabled={loading}
            >
              {loading
                ? 'Actualizando...'
                : 'Actualizar'}
            </button>
          </div>

          {error ? (
            <p role="alert">
              {error}
            </p>
          ) : null}

          
          {user.role === 'OWNER' ? (
            <>
              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  border:
                    '1px solid #e5e7eb',
                  borderRadius: '12px',
                }}
              >
                <h2>
                  Gestión de páginas
                </h2>

                <form
                  onSubmit={
                    handleCreateSite
                  }
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <input
                    type="text"
                    value={
                      newSiteName
                    }
                    placeholder="Nombre de página"
                    onChange={(event) => {
                      setNewSiteName(
                        event.target.value,
                      );
                    }}
                  />

                  <input
                    type="text"
                    value={
                      newSiteSlug
                    }
                    placeholder="Slug opcional"
                    onChange={(event) => {
                      setNewSiteSlug(
                        event.target.value,
                      );
                    }}
                  />

                  <input
                    type="text"
                    value={
                      newSiteDomain
                    }
                    placeholder="Dominio opcional"
                    onChange={(event) => {
                      setNewSiteDomain(
                        event.target.value,
                      );
                    }}
                  />

                  <button
                    type="submit"
                    disabled={
                      creatingSite
                    }
                  >
                    {creatingSite
                      ? 'Creando...'
                      : 'Crear página'}
                  </button>
                </form>

                {sites.length === 0 ? (
                  <p>
                    No hay páginas
                    creadas.
                  </p>
                ) : (
                  sites.map(
                    (site) => (
                      <div
                        key={site.id}
                        style={{
                          display:
                            'flex',
                          justifyContent:
                            'space-between',
                          alignItems:
                            'center',
                          gap: '12px',
                          padding:
                            '10px 0',
                          borderBottom:
                            '1px solid #e5e7eb',
                        }}
                      >
                        <div>
                          <strong>
                            {site.name}
                          </strong>

                          <div>
                            Slug:{' '}
                            {site.slug}
                          </div>

                          <div>
                            Dominio:{' '}
                            {site.domain ??
                              'Sin dominio'}
                          </div>

                          <div>
                            Estado:{' '}
                            {site.status}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={
                            managingSiteId ===
                            site.id
                          }
                          onClick={() => {
                            void handleSiteStatus(
                              site,
                            );
                          }}
                        >
                          {managingSiteId ===
                          site.id
                            ? 'Procesando...'
                            : site.status ===
                                'ACTIVE'
                              ? 'Desactivar'
                              : 'Reactivar'}
                        </button>
                      </div>
                    ),
                  )
                )}
              </div>

              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  border:
                    '1px solid #e5e7eb',
                  borderRadius: '12px',
                }}
              >
                <h2>
                  Gestión de administradores
                </h2>

                <form
                  onSubmit={
                    handleCreateAdmin
                  }
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <input
                    type="text"
                    value={
                      newAdminUsername
                    }
                    placeholder="Nombre de usuario"
                    onChange={(event) => {
                      setNewAdminUsername(
                        event.target.value,
                      );
                    }}
                  />

                  <select
                    value={
                      selectedAdminSiteId
                    }
                    onChange={(event) => {
                      setSelectedAdminSiteId(
                        event.target.value,
                      );
                    }}
                  >
                    <option value="">
                      Selecciona página
                    </option>

                    {activeSites.map(
                      (site) => (
                        <option
                          key={site.id}
                          value={site.id}
                        >
                          {site.name}
                        </option>
                      ),
                    )}
                  </select>

                  <button
                    type="submit"
                    disabled={
                      creatingAdmin ||
                      activeSites.length ===
                        0
                    }
                  >
                    {creatingAdmin
                      ? 'Creando...'
                      : 'Crear administrador'}
                  </button>
                </form>

                {activeSites.length ===
                0 ? (
                  <p>
                    Necesitas al menos
                    una página activa para
                    crear administradores.
                  </p>
                ) : null}

                {createdAdmin ? (
                  <div>
                    <strong>
                      Administrador creado
                    </strong>

                    <p>
                      Usuario:{' '}
                      <strong>
                        {
                          createdAdmin.username
                        }
                      </strong>
                    </p>

                    <p>
                      Contraseña temporal:{' '}
                      <strong>
                        {
                          createdAdmin.password
                        }
                      </strong>
                    </p>

                    <p>
                      Guarda esta
                      contraseña antes de
                      continuar.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setCreatedAdmin(
                          null,
                        );
                      }}
                    >
                      Ocultar
                    </button>
                  </div>
                ) : null}

                {admins.length === 0 ? (
                  <p>
                    No hay administradores
                    creados.
                  </p>
                ) : (
                  admins.map(
                    (admin) => (
                      <div
                        key={admin.id}
                        style={{
                          display:
                            'flex',
                          justifyContent:
                            'space-between',
                          alignItems:
                            'center',
                          gap: '12px',
                          padding:
                            '10px 0',
                          borderBottom:
                            '1px solid #e5e7eb',
                        }}
                      >
                        <div>
                          <strong>
                            {
                              admin.username
                            }
                          </strong>

                          <div>
                            Página:{' '}
                            {getSiteName(
                              admin.siteId,
                            )}
                          </div>

                          <div>
                            Estado:{' '}
                            {
                              admin.status
                            }
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={
                            managingUserId ===
                            admin.id
                          }
                          onClick={() => {
                            void handleUserStatus(
                              admin,
                            );
                          }}
                        >
                          {managingUserId ===
                          admin.id
                            ? 'Procesando...'
                            : admin.status ===
                                'ACTIVE'
                              ? 'Desactivar'
                              : 'Reactivar'}
                        </button>
                      </div>
                    ),
                  )
                )}
              </div>
            </>
          ) : null}

          {user.role === 'ADMIN' ? (
  <div
    style={{
      marginTop: '20px',
      padding: '16px',
      border:
        '1px solid #e5e7eb',
      borderRadius: '12px',
    }}
  >
    <h2>
      Gestión de agentes
    </h2>

    <form
      onSubmit={
        handleCreateAgent
      }
      style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
      }}
    >
      <input
        type="text"
        value={
          newAgentUsername
        }
        placeholder="Nombre de usuario"
        onChange={(event) => {
          setNewAgentUsername(
            event.target.value,
          );
        }}
      />

      <button
        type="submit"
        disabled={
          creatingAgent
        }
      >
        {creatingAgent
          ? 'Creando...'
          : 'Crear agente'}
      </button>
    </form>

    {createdAgent ? (
      <div
        style={{
          padding: '12px',
          marginBottom:
            '16px',
          border:
            '1px solid #e5e7eb',
          borderRadius: '8px',
        }}
      >
        <strong>
          Agente creado
        </strong>

        <p>
          Usuario:{' '}
          <strong>
            {
              createdAgent.username
            }
          </strong>
        </p>

        <p>
          Contraseña temporal:{' '}
          <strong>
            {
              createdAgent.password
            }
          </strong>
        </p>

        <p>
          Guarda esta contraseña
          antes de continuar.
        </p>

        <button
          type="button"
          onClick={() => {
            setCreatedAgent(
              null,
            );
          }}
        >
          Ocultar
        </button>
      </div>
    ) : null}

    {allAgents.length ===
    0 ? (
      <p>
        No hay agentes
        creados.
      </p>
    ) : (
      <div>
        {allAgents.map(
          (agent) => (
            <div
              key={
                agent.id
              }
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'space-between',

                gap: '12px',

                padding:
                  '10px 0',

                borderBottom:
                  '1px solid #e5e7eb',
              }}
            >
              <div>
                <strong>
                  {
                    agent.username
                  }
                </strong>

                <div>
                  Estado:{' '}
                  {
                    agent.status
                  }
                </div>
              </div>

              <button
                type="button"
                disabled={
                  managingUserId ===
                  agent.id
                }
                onClick={() => {
                  void handleUserStatus(
                    agent,
                  );
                }}
              >
                {managingUserId ===
                agent.id
                  ? 'Procesando...'
                  : agent.status ===
                      'ACTIVE'
                    ? 'Desactivar'
                    : 'Reactivar'}
              </button>
            </div>
          ),
        )}
      </div>
    )}
  </div>
) : null}

          <div className="nova-admin-summary">
            <span>
              Agentes activos:{' '}
              <strong>
                {agents.length}
              </strong>
            </span>

            <span>
              Conversaciones:{' '}
              <strong>
                {
                  conversations.length
                }
              </strong>
            </span>
          </div>

          <div className="nova-admin-layout">
            <div className="nova-admin-conversations">
              {loading ? (
                <div className="nova-admin-conversations__loading">
                  Cargando
                  conversaciones...
                </div>
              ) : conversations.length ===
                0 ? (
                <div className="nova-admin-conversations__loading">
                  No hay
                  conversaciones.
                </div>
              ) : (
                conversations.map(
                  (
                    conversation,
                  ) => {
                    const isSelected =
                      activeConversation
                        ?.id ===
                      conversation.id;

                    const conversationSiteId =
                      (
                        conversation as ConversationSummary & {
                          siteId?: string | null;
                        }
                      ).siteId ??
                      null;

                    const availableAgents =
                      conversationSiteId
                        ? agents.filter(
                            (agent) =>
                              agent.siteId ===
                              conversationSiteId,
                          )
                        : agents;

                    return (
                      <div
                        key={
                          conversation.id
                        }
                        className={
                          isSelected
                            ? 'nova-admin-conversation-card nova-admin-conversation-card--selected'
                            : 'nova-admin-conversation-card'
                        }
                      >
                        <div className="nova-admin-conversation-card__top">
                          <strong>
                            Visitante{' '}
                            {conversation.visitor.id.slice(
                              0,
                              8,
                            )}
                          </strong>

                          <span>
                            {
                              conversation.status
                            }
                          </span>
                        </div>

                        <p>
                          Página:{' '}
                          <strong>
                            {getSiteName(
                              conversationSiteId,
                            )}
                          </strong>
                        </p>

                        <p>
                          Asignado:{' '}
                          <strong>
                            {conversation
                              .assignedAgent
                              ?.username ??
                              'Sin asignar'}
                          </strong>
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            void handleOpenConversation(
                              conversation.id,
                            );
                          }}
                        >
                          {isSelected
                            ? 'Chat abierto'
                            : 'Ver chat'}
                        </button>

                        {conversation.status !==
                        'CLOSED' ? (
                          <div className="nova-admin-conversation-actions">
                            <select
                              value={
                                selectedAgents[
                                  conversation
                                    .id
                                ] ??
                                conversation
                                  .assignedAgentId ??
                                ''
                              }
                              onChange={(
                                event,
                              ) => {
                                setSelectedAgents(
                                  (
                                    current,
                                  ) => ({
                                    ...current,

                                    [conversation.id]:
                                      event
                                        .target
                                        .value,
                                  }),
                                );
                              }}
                            >
                              <option value="">
                                Selecciona
                                agente
                              </option>

                              {availableAgents.map(
                                (
                                  agent,
                                ) => (
                                  <option
                                    key={
                                      agent.id
                                    }
                                    value={
                                      agent.id
                                    }
                                  >
                                    {
                                      agent.username
                                    }
                                  </option>
                                ),
                              )}
                            </select>

                            <button
                              type="button"
                              disabled={
                                assigningConversationId ===
                                conversation.id
                              }
                              onClick={() => {
                                void handleAssign(
                                  conversation,
                                );
                              }}
                            >
                              {assigningConversationId ===
                              conversation.id
                                ? 'Asignando...'
                                : conversation
                                      .assignedAgentId
                                  ? 'Reasignar'
                                  : 'Asignar'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  },
                )
              )}
            </div>

            {loadingConversation ? (
              <div className="nova-admin-chat nova-admin-chat--placeholder">
                Cargando
                conversación...
              </div>
            ) : activeConversation ? (
              <div className="nova-admin-chat">
                <header className="nova-admin-chat__header">
                  <div>
                    <h2>
                      Visitante{' '}
                      {activeConversation
                        .visitor.id.slice(
                          0,
                          8,
                        )}
                    </h2>

                    <span>
                      Estado:{' '}
                      <strong>
                        {
                          activeConversation.status
                        }
                      </strong>
                    </span>

                    <span>
                      Agente:{' '}
                      <strong>
                        {activeConversation
                          .assignedAgent
                          ?.username ??
                          'Sin asignar'}
                      </strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveConversation(
                        null,
                      );
                    }}
                  >
                    Cerrar chat
                  </button>
                </header>

                <div className="nova-admin-chat__messages">
                  {activeConversation
                    .messages.length ===
                  0 ? (
                    <div className="nova-admin-chat__empty">
                      Esta conversación
                      todavía no tiene
                      mensajes.
                    </div>
                  ) : (
                    activeConversation.messages.map(
                      (
                        message,
                      ) => (
                        <div
                          key={
                            message.id
                          }
                          className={
                            message.senderType ===
                            'USER'
                              ? 'nova-admin-chat__message nova-admin-chat__message--agent'
                              : 'nova-admin-chat__message nova-admin-chat__message--visitor'
                          }
                        >
                          {message.type ===
                            'IMAGE' &&
                          message.mediaUrl ? (
                            <img
                              src={`${NOVA_API_URL}${message.mediaUrl}`}
                              alt="Imagen del chat"
                            />
                          ) : null}

                          {message.content ? (
                            <div>
                              {
                                message.content
                              }
                            </div>
                          ) : null}

                          <small>
                            {new Date(
                              message.createdAt,
                            ).toLocaleString()}
                          </small>
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="nova-admin-chat nova-admin-chat--placeholder">
                <div>
                  <h2>
                    Selecciona una
                    conversación
                  </h2>

                  <p>
                    Pulsa “Ver chat”
                    para visualizar
                    los mensajes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}