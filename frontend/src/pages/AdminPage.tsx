import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  SyntheticEvent,
} from 'react';

import {
  NOVA_API_URL,
  getStoredAccessToken,
  getValidAccessToken,
} from '../auth/auth';

import type {
  AuthUser,
} from '../auth/auth';

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

type ConversationWithSite =
  ConversationSummary & {
    siteId?: string | null;
  };

function sortConversations(
  conversations:
    ConversationSummary[],
) {
  return [
    ...conversations,
  ].sort(
    (
      a,
      b,
    ) =>
      new Date(
        b.updatedAt,
      ).getTime() -
      new Date(
        a.updatedAt,
      ).getTime(),
  );
}

function formatTime(
  value: string,
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
      value,
    ),
  );
}

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'es-CL',
    {
      day:
        '2-digit',

      month:
        '2-digit',

      year:
        '2-digit',

      hour:
        '2-digit',

      minute:
        '2-digit',

      hour12:
        false,
    },
  ).format(
    new Date(
      value,
    ),
  );
}

function getConversationStatusLabel(
  status:
    ConversationSummary['status'],
) {
  if (
    status ===
    'OPEN'
  ) {
    return 'Abierta';
  }

  if (
    status ===
    'PENDING'
  ) {
    return 'Pendiente';
  }

  return 'Cerrada';
}

function getLastMessage(
  conversation:
    ConversationSummary,
) {
  const message =
    conversation
      .messages[0];

  if (
    !message
  ) {
    return 'Sin mensajes';
  }

  if (
    message.type ===
    'IMAGE'
  ) {
    return message.content
      ? `📷 ${message.content}`
      : '📷 Imagen';
  }

  return (
    message.content ??
    'Mensaje'
  );
}

function ConversationStatus({
  status,
}: {
  status:
    ConversationSummary['status'];
}) {
  return (
    <span
      className={
        status ===
        'OPEN'
          ? 'nova-admin-status nova-admin-status--active'
          : status ===
              'PENDING'
            ? 'nova-admin-status nova-admin-status--pending'
            : 'nova-admin-status nova-admin-status--inactive'
      }
    >
      {getConversationStatusLabel(
        status,
      )}
    </span>
  );
}

function EntityStatus({
  status,
}: {
  status: string;
}) {
  const active =
    status ===
    'ACTIVE';

  return (
    <span
      className={
        active
          ? 'nova-admin-status nova-admin-status--active'
          : 'nova-admin-status nova-admin-status--inactive'
      }
    >
      {active
        ? 'Activo'
        : 'Inactivo'}
    </span>
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
  ] =
    await Promise.all([
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
    conversations:
      sortConversations(
        conversations,
      ),

    users,

    sites,
  };
}

export function AdminPage({
  user,
  onLogout,
}: AdminPageProps) {
  const workspaceId =
    user.workspaceId ??
    '';

  const activeConversationIdRef =
    useRef<
      string | null
    >(null);

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
    useState(
      false,
    );

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
      Record<
        string,
        string
      >
    >({});

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

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
    notification,
    setNotification,
  ] =
    useState<
      string | null
    >(null);

  const notificationTimeoutRef =
    useRef<
      number | null
    >(null);

  const [
    newAgentUsername,
    setNewAgentUsername,
  ] =
    useState('');

  const [
    creatingAgent,
    setCreatingAgent,
  ] =
    useState(
      false,
    );

  const [
    managingUserId,
    setManagingUserId,
  ] =
    useState<
      string | null
    >(null);

  const [
    createdAgent,
    setCreatedAgent,
  ] =
    useState<{
      username: string;
      password: string;
    } | null>(
      null,
    );

  const [
    newAdminUsername,
    setNewAdminUsername,
  ] =
    useState('');

  const [
    selectedAdminSiteId,
    setSelectedAdminSiteId,
  ] =
    useState('');

  const [
    newSiteName,
    setNewSiteName,
  ] =
    useState('');

  const [
    newSiteSlug,
    setNewSiteSlug,
  ] =
    useState('');

  const [
    newSiteDomain,
    setNewSiteDomain,
  ] =
    useState('');

  const [
    creatingSite,
    setCreatingSite,
  ] =
    useState(
      false,
    );

  const [
    managingSiteId,
    setManagingSiteId,
  ] =
    useState<
      string | null
    >(null);

  const [
    creatingAdmin,
    setCreatingAdmin,
  ] =
    useState(
      false,
    );

  const [
    createdAdmin,
    setCreatedAdmin,
  ] =
    useState<{
      username: string;
      password: string;
    } | null>(
      null,
    );

  const agents =
    users.filter(
      (
        workspaceUser,
      ) =>
        workspaceUser.role ===
          'AGENT' &&
        workspaceUser.status ===
          'ACTIVE',
    );

  const allAgents =
    users.filter(
      (
        workspaceUser,
      ) =>
        workspaceUser.role ===
        'AGENT',
    );

  const admins =
    users.filter(
      (
        workspaceUser,
      ) =>
        workspaceUser.role ===
        'ADMIN',
    );

  const activeSites =
    sites.filter(
      (
        site,
      ) =>
        site.status ===
        'ACTIVE',
    );

  const activeConversationCount =
    conversations.filter(
      (
        conversation,
      ) =>
        conversation.status !==
        'CLOSED',
    ).length;

  const unassignedConversationCount =
    conversations.filter(
      (
        conversation,
      ) =>
        conversation.assignedAgentId ===
          null &&
        conversation.status !==
          'CLOSED',
    ).length;

  function getSiteName(
    siteId:
      string | null,
  ) {
    if (
      !siteId
    ) {
      return 'Sin página';
    }

    return (
      sites.find(
        (
          site,
        ) =>
          site.id ===
          siteId,
      )?.name ??
      'Página desconocida'
    );
  }

  function showNotification(
    message: string,
  ) {
    if (
      notificationTimeoutRef
        .current !==
      null
    ) {
      window.clearTimeout(
        notificationTimeoutRef
          .current,
      );
    }

    setNotification(
      message,
    );

    notificationTimeoutRef.current =
      window.setTimeout(
        () => {
          setNotification(
            null,
          );

          notificationTimeoutRef.current =
            null;
        },
        4000,
      );
  }

  useEffect(
    () => {
      return () => {
        if (
          notificationTimeoutRef
            .current !==
          null
        ) {
          window.clearTimeout(
            notificationTimeoutRef
              .current,
          );
        }
      };
    },
    [],
  );

  useEffect(
    () => {
      activeConversationIdRef.current =
        activeConversation
          ?.id ??
        null;
    },
    [
      activeConversation
        ?.id,
    ],
  );

  async function loadData() {
    if (
      !workspaceId
    ) {
      return;
    }

    try {
      setLoading(
        true,
      );

      setError(
        null,
      );

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
          : 'No se pudo cargar la administración',
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  useEffect(
    () => {
      let cancelled =
        false;

      async function loadInitialData() {
        if (
          !workspaceId
        ) {
          return;
        }

        try {
          const data =
            await fetchAdminData(
              workspaceId,
            );

          if (
            cancelled
          ) {
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

          setError(
            null,
          );
        } catch (
          err
        ) {
          if (
            cancelled
          ) {
            return;
          }

          console.error(
            err,
          );

          setError(
            err instanceof
              Error
              ? err.message
              : 'No se pudo cargar la administración',
          );
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false,
            );
          }
        }
      }

      void loadInitialData();

      return () => {
        cancelled =
          true;
      };
    },
    [
      workspaceId,
    ],
  );

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

      if (
        !accessToken
      ) {
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

          if (
            cancelled
          ) {
            return;
          }

          setConversations(
            sortConversations(
              latestConversations,
            ),
          );
        } catch (
          err
        ) {
          if (
            cancelled
          ) {
            return;
          }

          console.error(
            'No se pudo resincronizar la bandeja administrativa:',
            err,
          );

          setError(
            err instanceof
              Error
              ? err.message
              : 'No se pudieron actualizar las conversaciones',
          );
        }
      }

      async function refreshOpenConversation(
        conversationId:
          string,
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
        } catch (
          err
        ) {
          if (
            cancelled
          ) {
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
              if (
                cancelled
              ) {
                return;
              }

              void syncConversations();
            },

            onConversationUpdated(
              conversation,
            ) {
              if (
                cancelled
              ) {
                return;
              }

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
              if (
                cancelled
              ) {
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
    event:
      SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const username =
      newAdminUsername
        .trim();

    if (
      !username
    ) {
      setError(
        'Escribe un nombre de usuario',
      );

      return;
    }

    if (
      !selectedAdminSiteId
    ) {
      setError(
        'Selecciona una página para el administrador',
      );

      return;
    }

    try {
      setCreatingAdmin(
        true,
      );

      setError(
        null,
      );

      setCreatedAdmin(
        null,
      );

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

      setNewAdminUsername(
        '',
      );

      setSelectedAdminSiteId(
        '',
      );

      await loadData();
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
          : 'No se pudo crear el administrador',
      );
    } finally {
      setCreatingAdmin(
        false,
      );
    }
  }

  async function handleCreateSite(
    event:
      SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name =
      newSiteName
        .trim();

    if (
      !name
    ) {
      setError(
        'Escribe un nombre para la página',
      );

      return;
    }

    try {
      setCreatingSite(
        true,
      );

      setError(
        null,
      );

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
            newSiteSlug
              .trim() ||
            undefined,

          domain:
            newSiteDomain
              .trim() ||
            undefined,
        },
      );

      setNewSiteName(
        '',
      );

      setNewSiteSlug(
        '',
      );

      setNewSiteDomain(
        '',
      );

      await loadData();
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
          : 'No se pudo crear la página',
      );
    } finally {
      setCreatingSite(
        false,
      );
    }
  }

  async function handleSiteStatus(
    site: Site,
  ) {
    try {
      setManagingSiteId(
        site.id,
      );

      setError(
        null,
      );

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
        site.status ===
          'ACTIVE'
      ) {
        setSelectedAdminSiteId(
          '',
        );
      }

      await loadData();
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
          : 'No se pudo cambiar el estado de la página',
      );
    } finally {
      setManagingSiteId(
        null,
      );
    }
  }

  async function handleCreateAgent(
    event:
      SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const username =
      newAgentUsername
        .trim();

    if (
      !username
    ) {
      setError(
        'Escribe un nombre de usuario',
      );

      return;
    }

    try {
      setCreatingAgent(
        true,
      );

      setError(
        null,
      );

      setCreatedAgent(
        null,
      );

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

      setNewAgentUsername(
        '',
      );

      await loadData();
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
          : 'No se pudo crear el agente',
      );
    } finally {
      setCreatingAgent(
        false,
      );
    }
  }

  async function handleUserStatus(
    targetUser:
      WorkspaceUser,
  ) {
    try {
      setManagingUserId(
        targetUser.id,
      );

      setError(
        null,
      );

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
          : 'No se pudo cambiar el estado del usuario',
      );
    } finally {
      setManagingUserId(
        null,
      );
    }
  }

  async function handleOpenConversation(
    conversationId:
      string,
  ) {
    try {
      setLoadingConversation(
        true,
      );

      setError(
        null,
      );

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
      conversation
        .assignedAgentId ??
      '';

    if (
      !agentId
    ) {
      setError(
        'Selecciona un agente',
      );

      return;
    }

    const selectedAgent =
      users.find(
        (
          workspaceUser,
        ) =>
          workspaceUser.id ===
          agentId,
      );

    const conversationSiteId =
      (
        conversation as
          ConversationWithSite
      ).siteId ??
      null;

    if (
      conversationSiteId &&
      selectedAgent
        ?.siteId !==
        conversationSiteId
    ) {
      setError(
        'El agente debe pertenecer a la misma página que la conversación',
      );

      return;
    }

    const wasAssigned =
      Boolean(
        conversation
          .assignedAgentId,
      );

    try {
      setAssigningConversationId(
        conversation.id,
      );

      setError(
        null,
      );

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

      showNotification(
        wasAssigned
          ? 'Conversación reasignada exitosamente.'
          : 'Conversación asignada exitosamente.',
      );

      await loadData();

      if (
        activeConversation
          ?.id ===
        conversation.id
      ) {
        await handleOpenConversation(
          conversation.id,
        );
      }
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
          : 'No se pudo asignar la conversación',
      );
    } finally {
      setAssigningConversationId(
        null,
      );
    }
  }

  if (
    !workspaceId
  ) {
    return (
      <main className="nova-loading">
        Workspace no disponible.
      </main>
    );
  }

  return (
    <main className="nova-dashboard nova-admin-page">
      <header className="nova-dashboard__header nova-admin-topbar">
        <div className="nova-dashboard__brand">
          <div className="nova-dashboard__logo">
            N
          </div>

          <div className="nova-admin-topbar__brand-text">
            <strong>
              Nova
            </strong>

            <span>
              Administración
            </span>
          </div>
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
            onClick={
              onLogout
            }
          >
            Salir
          </button>
        </div>
      </header>

      <section className="nova-admin-shell">
        <div className="nova-admin-heading">
          <div>
            <span className="nova-admin-heading__eyebrow">
              {user.role ===
              'OWNER'
                ? 'Workspace'
                : 'Página'}
            </span>

            <h1>
              Panel de administración
            </h1>

            <p>
              {user.role ===
              'OWNER'
                ? 'Gestiona páginas, administradores, agentes y conversaciones desde un solo lugar.'
                : 'Gestiona tus agentes y las conversaciones de tu página.'}
            </p>
          </div>

          <button
            type="button"
            className="nova-admin-refresh"
            disabled={
              loading
            }
            onClick={() => {
              void loadData();
            }}
          >
            <span>
              ↻
            </span>

            {loading
              ? 'Actualizando...'
              : 'Actualizar'}
          </button>
        </div>

        {error ? (
          <div
            className="nova-admin-error"
            role="alert"
          >
            <div>
              <strong>
                No se pudo completar la operación
              </strong>

              <span>
                {error}
              </span>
            </div>

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

        <div className="nova-admin-overview">
          <div className="nova-admin-stat">
            <div className="nova-admin-stat__icon">
              💬
            </div>

            <div>
              <span>
                Conversaciones
              </span>

              <strong>
                {
                  conversations.length
                }
              </strong>
            </div>
          </div>

          <div className="nova-admin-stat">
            <div className="nova-admin-stat__icon">
              ●
            </div>

            <div>
              <span>
                Activas
              </span>

              <strong>
                {
                  activeConversationCount
                }
              </strong>
            </div>
          </div>

          <div className="nova-admin-stat">
            <div className="nova-admin-stat__icon">
              ⏱
            </div>

            <div>
              <span>
                Sin asignar
              </span>

              <strong>
                {
                  unassignedConversationCount
                }
              </strong>
            </div>
          </div>

          <div className="nova-admin-stat">
            <div className="nova-admin-stat__icon">
              👤
            </div>

            <div>
              <span>
                Agentes activos
              </span>

              <strong>
                {
                  agents.length
                }
              </strong>
            </div>
          </div>

          {user.role ===
          'OWNER' ? (
            <div className="nova-admin-stat">
              <div className="nova-admin-stat__icon">
                ◫
              </div>

              <div>
                <span>
                  Páginas activas
                </span>

                <strong>
                  {
                    activeSites.length
                  }
                </strong>
              </div>
            </div>
          ) : null}
        </div>

        {user.role ===
        'OWNER' ? (
          <section className="nova-admin-management-grid">
            <article className="nova-admin-panel">
              <div className="nova-admin-panel__header">
                <div>
                  <span className="nova-admin-panel__icon">
                    ◫
                  </span>

                  <div>
                    <h2>
                      Páginas
                    </h2>

                    <p>
                      Gestiona los sitios conectados a Nova.
                    </p>
                  </div>
                </div>

                <span className="nova-admin-panel__count">
                  {
                    sites.length
                  }
                </span>
              </div>

              <form
                className="nova-admin-form nova-admin-form--site"
                onSubmit={
                  handleCreateSite
                }
              >
                <div className="nova-admin-field">
                  <label htmlFor="nova-site-name">
                    Nombre
                  </label>

                  <input
                    id="nova-site-name"
                    type="text"
                    value={
                      newSiteName
                    }
                    placeholder="Ej. Sitio principal"
                    onChange={(
                      event,
                    ) => {
                      setNewSiteName(
                        event.target.value,
                      );
                    }}
                  />
                </div>

                <div className="nova-admin-field">
                  <label htmlFor="nova-site-slug">
                    Slug
                  </label>

                  <input
                    id="nova-site-slug"
                    type="text"
                    value={
                      newSiteSlug
                    }
                    placeholder="Opcional"
                    onChange={(
                      event,
                    ) => {
                      setNewSiteSlug(
                        event.target.value,
                      );
                    }}
                  />
                </div>

                <div className="nova-admin-field">
                  <label htmlFor="nova-site-domain">
                    Dominio
                  </label>

                  <input
                    id="nova-site-domain"
                    type="text"
                    value={
                      newSiteDomain
                    }
                    placeholder="Opcional"
                    onChange={(
                      event,
                    ) => {
                      setNewSiteDomain(
                        event.target.value,
                      );
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="nova-admin-primary-button"
                  disabled={
                    creatingSite
                  }
                >
                  {creatingSite
                    ? 'Creando...'
                    : 'Crear página'}
                </button>
              </form>

              <div className="nova-admin-list">
                {sites.length ===
                0 ? (
                  <div className="nova-admin-empty">
                    <strong>
                      Sin páginas
                    </strong>

                    <span>
                      Crea la primera página para comenzar.
                    </span>
                  </div>
                ) : (
                  sites.map(
                    (
                      site,
                    ) => (
                      <div
                        key={
                          site.id
                        }
                        className="nova-admin-list-row"
                      >
                        <div className="nova-admin-list-row__main">
                          <div className="nova-admin-list-row__avatar">
                            {site.name
                              .slice(
                                0,
                                2,
                              )
                              .toUpperCase()}
                          </div>

                          <div className="nova-admin-list-row__content">
                            <div className="nova-admin-list-row__title">
                              <strong>
                                {
                                  site.name
                                }
                              </strong>

                              <EntityStatus
                                status={
                                  site.status
                                }
                              />
                            </div>

                            <div className="nova-admin-list-row__meta">
                              <span>
                                Slug:{' '}
                                <strong>
                                  {
                                    site.slug
                                  }
                                </strong>
                              </span>

                              <span>
                                {site.domain ??
                                  'Sin dominio configurado'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={
                            site.status ===
                            'ACTIVE'
                              ? 'nova-admin-secondary-button nova-admin-secondary-button--danger'
                              : 'nova-admin-secondary-button'
                          }
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
            </article>

            <article className="nova-admin-panel">
              <div className="nova-admin-panel__header">
                <div>
                  <span className="nova-admin-panel__icon">
                    👤
                  </span>

                  <div>
                    <h2>
                      Administradores
                    </h2>

                    <p>
                      Asigna un administrador a cada página.
                    </p>
                  </div>
                </div>

                <span className="nova-admin-panel__count">
                  {
                    admins.length
                  }
                </span>
              </div>

              <form
                className="nova-admin-form nova-admin-form--admin"
                onSubmit={
                  handleCreateAdmin
                }
              >
                <div className="nova-admin-field">
                  <label htmlFor="nova-admin-username">
                    Usuario
                  </label>

                  <input
                    id="nova-admin-username"
                    type="text"
                    value={
                      newAdminUsername
                    }
                    placeholder="Nombre de usuario"
                    onChange={(
                      event,
                    ) => {
                      setNewAdminUsername(
                        event.target.value,
                      );
                    }}
                  />
                </div>

                <div className="nova-admin-field">
                  <label htmlFor="nova-admin-site">
                    Página
                  </label>

                  <select
                    id="nova-admin-site"
                    value={
                      selectedAdminSiteId
                    }
                    onChange={(
                      event,
                    ) => {
                      setSelectedAdminSiteId(
                        event.target.value,
                      );
                    }}
                  >
                    <option value="">
                      Selecciona una página
                    </option>

                    {activeSites.map(
                      (
                        site,
                      ) => (
                        <option
                          key={
                            site.id
                          }
                          value={
                            site.id
                          }
                        >
                          {
                            site.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <button
                  type="submit"
                  className="nova-admin-primary-button"
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
                <div className="nova-admin-info">
                  Necesitas al menos una página activa para crear administradores.
                </div>
              ) : null}

              {createdAdmin ? (
                <div className="nova-admin-credentials">
                  <div className="nova-admin-credentials__icon">
                    ✓
                  </div>

                  <div className="nova-admin-credentials__content">
                    <strong>
                      Administrador creado
                    </strong>

                    <span>
                      Guarda estas credenciales antes de cerrar este aviso.
                    </span>

                    <dl>
                      <div>
                        <dt>
                          Usuario
                        </dt>

                        <dd>
                          {
                            createdAdmin.username
                          }
                        </dd>
                      </div>

                      <div>
                        <dt>
                          Contraseña temporal
                        </dt>

                        <dd>
                          {
                            createdAdmin.password
                          }
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <button
                    type="button"
                    aria-label="Ocultar credenciales"
                    onClick={() => {
                      setCreatedAdmin(
                        null,
                      );
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : null}

              <div className="nova-admin-list">
                {admins.length ===
                0 ? (
                  <div className="nova-admin-empty">
                    <strong>
                      Sin administradores
                    </strong>

                    <span>
                      Todavía no hay administradores creados.
                    </span>
                  </div>
                ) : (
                  admins.map(
                    (
                      admin,
                    ) => (
                      <div
                        key={
                          admin.id
                        }
                        className="nova-admin-list-row"
                      >
                        <div className="nova-admin-list-row__main">
                          <div className="nova-admin-list-row__avatar">
                            {admin.username
                              .slice(
                                0,
                                2,
                              )
                              .toUpperCase()}
                          </div>

                          <div className="nova-admin-list-row__content">
                            <div className="nova-admin-list-row__title">
                              <strong>
                                {
                                  admin.username
                                }
                              </strong>

                              <EntityStatus
                                status={
                                  admin.status
                                }
                              />
                            </div>

                            <div className="nova-admin-list-row__meta">
                              <span>
                                Página:{' '}
                                <strong>
                                  {getSiteName(
                                    admin.siteId,
                                  )}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={
                            admin.status ===
                            'ACTIVE'
                              ? 'nova-admin-secondary-button nova-admin-secondary-button--danger'
                              : 'nova-admin-secondary-button'
                          }
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
            </article>
          </section>
        ) : null}

        {user.role ===
        'ADMIN' ? (
          <section className="nova-admin-management-grid nova-admin-management-grid--single">
            <article className="nova-admin-panel">
              <div className="nova-admin-panel__header">
                <div>
                  <span className="nova-admin-panel__icon">
                    🎧
                  </span>

                  <div>
                    <h2>
                      Agentes
                    </h2>

                    <p>
                      Gestiona el equipo que atenderá las conversaciones.
                    </p>
                  </div>
                </div>

                <span className="nova-admin-panel__count">
                  {
                    allAgents.length
                  }
                </span>
              </div>

              <form
                className="nova-admin-form nova-admin-form--agent"
                onSubmit={
                  handleCreateAgent
                }
              >
                <div className="nova-admin-field">
                  <label htmlFor="nova-agent-username">
                    Nombre de usuario
                  </label>

                  <input
                    id="nova-agent-username"
                    type="text"
                    value={
                      newAgentUsername
                    }
                    placeholder="Ej. soporte_01"
                    onChange={(
                      event,
                    ) => {
                      setNewAgentUsername(
                        event.target.value,
                      );
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="nova-admin-primary-button"
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
                <div className="nova-admin-credentials">
                  <div className="nova-admin-credentials__icon">
                    ✓
                  </div>

                  <div className="nova-admin-credentials__content">
                    <strong>
                      Agente creado
                    </strong>

                    <span>
                      Guarda estas credenciales antes de cerrar este aviso.
                    </span>

                    <dl>
                      <div>
                        <dt>
                          Usuario
                        </dt>

                        <dd>
                          {
                            createdAgent.username
                          }
                        </dd>
                      </div>

                      <div>
                        <dt>
                          Contraseña temporal
                        </dt>

                        <dd>
                          {
                            createdAgent.password
                          }
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <button
                    type="button"
                    aria-label="Ocultar credenciales"
                    onClick={() => {
                      setCreatedAgent(
                        null,
                      );
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : null}

              <div className="nova-admin-list">
                {allAgents.length ===
                0 ? (
                  <div className="nova-admin-empty">
                    <strong>
                      Sin agentes
                    </strong>

                    <span>
                      Crea el primer agente para comenzar a atender conversaciones.
                    </span>
                  </div>
                ) : (
                  allAgents.map(
                    (
                      agent,
                    ) => (
                      <div
                        key={
                          agent.id
                        }
                        className="nova-admin-list-row"
                      >
                        <div className="nova-admin-list-row__main">
                          <div className="nova-admin-list-row__avatar">
                            {agent.username
                              .slice(
                                0,
                                2,
                              )
                              .toUpperCase()}
                          </div>

                          <div className="nova-admin-list-row__content">
                            <div className="nova-admin-list-row__title">
                              <strong>
                                {
                                  agent.username
                                }
                              </strong>

                              <EntityStatus
                                status={
                                  agent.status
                                }
                              />
                            </div>

                            <div className="nova-admin-list-row__meta">
                              <span>
                                Agente de soporte
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={
                            agent.status ===
                            'ACTIVE'
                              ? 'nova-admin-secondary-button nova-admin-secondary-button--danger'
                              : 'nova-admin-secondary-button'
                          }
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
                  )
                )}
              </div>
            </article>
          </section>
        ) : null}

        <section className="nova-admin-conversation-section">
          <div className="nova-admin-section-heading">
            <div>
              <h2>
                Conversaciones
              </h2>

              <p>
                Revisa el historial y asigna cada conversación al agente correspondiente.
              </p>
            </div>

            <span>
              {
                conversations.length
              }{' '}
              total
            </span>
          </div>

          <div className="nova-admin-workspace">
            <aside className="nova-admin-conversations">
              <div className="nova-admin-conversations__header">
                <strong>
                  Bandeja
                </strong>

                <span>
                  {
                    conversations.length
                  }
                </span>
              </div>

              {loading ? (
                <div className="nova-admin-conversations__loading">
                  Cargando conversaciones...
                </div>
              ) : conversations.length ===
                0 ? (
                <div className="nova-admin-empty">
                  <strong>
                    Sin conversaciones
                  </strong>

                  <span>
                    Todavía no existen conversaciones en esta página.
                  </span>
                </div>
              ) : (
                <div className="nova-admin-conversation-list">
                  {conversations.map(
                    (
                      conversation,
                    ) => {
                      const isSelected =
                        activeConversation
                          ?.id ===
                        conversation.id;

                      const conversationSiteId =
                        (
                          conversation as
                            ConversationWithSite
                        ).siteId ??
                        null;

                      const availableAgents =
                        conversationSiteId
                          ? agents.filter(
                              (
                                agent,
                              ) =>
                                agent.siteId ===
                                conversationSiteId,
                            )
                          : agents;

                      return (
                        <article
                          key={
                            conversation.id
                          }
                          className={
                            isSelected
                              ? 'nova-admin-conversation-card nova-admin-conversation-card--selected'
                              : 'nova-admin-conversation-card'
                          }
                        >
                          <button
                            type="button"
                            className="nova-admin-conversation-card__open"
                            onClick={() => {
                              void handleOpenConversation(
                                conversation.id,
                              );
                            }}
                          >
                            <div className="nova-admin-conversation-card__identity">
                              <div className="nova-admin-conversation-card__avatar">
                                {conversation.visitor.id
                                  .slice(
                                    0,
                                    2,
                                  )
                                  .toUpperCase()}
                              </div>

                              <div>
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
                            </div>

                            <div className="nova-admin-conversation-card__preview">
                              {getLastMessage(
                                conversation,
                              )}
                            </div>

                            <div className="nova-admin-conversation-card__details">
                              <ConversationStatus
                                status={
                                  conversation.status
                                }
                              />

                              <span>
                                {getSiteName(
                                  conversationSiteId,
                                )}
                              </span>
                            </div>

                            <div className="nova-admin-conversation-card__agent">
                              <span>
                                Agente
                              </span>

                              <strong>
                                {conversation
                                  .assignedAgent
                                  ?.username ??
                                  'Sin asignar'}
                              </strong>
                            </div>
                          </button>

                          {conversation.status !==
                          'CLOSED' ? (
                            <div className="nova-admin-conversation-actions">
                              <select
                                aria-label="Agente"
                                value={
                                  selectedAgents[
                                    conversation.id
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
                                        event.target.value,
                                    }),
                                  );
                                }}
                              >
                                <option value="">
                                  Selecciona agente
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
                        </article>
                      );
                    },
                  )}
                </div>
              )}
            </aside>

            {loadingConversation ? (
              <div className="nova-admin-chat nova-admin-chat--placeholder">
                <div className="nova-admin-chat-placeholder">
                  <div className="nova-admin-chat-placeholder__icon">
                    …
                  </div>

                  <h2>
                    Cargando conversación
                  </h2>

                  <p>
                    Espera un momento.
                  </p>
                </div>
              </div>
            ) : activeConversation ? (
              <div className="nova-admin-chat">
                <header className="nova-admin-chat__header">
                  <div className="nova-admin-chat__person">
                    <div className="nova-admin-chat__avatar">
                      {activeConversation.visitor.id
                        .slice(
                          0,
                          2,
                        )
                        .toUpperCase()}
                    </div>

                    <div>
                      <h2>
                        Visitante{' '}
                        {activeConversation.visitor.id.slice(
                          0,
                          8,
                        )}
                      </h2>

                      <div className="nova-admin-chat__meta">
                        <ConversationStatus
                          status={
                            activeConversation.status
                          }
                        />

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
                    </div>
                  </div>

                  <button
                    type="button"
                    className="nova-admin-chat__close"
                    onClick={() => {
                      setActiveConversation(
                        null,
                      );
                    }}
                  >
                    Cerrar
                  </button>
                </header>

                <div className="nova-admin-chat__messages">
                  {activeConversation
                    .messages.length ===
                  0 ? (
                    <div className="nova-admin-chat__empty">
                      Esta conversación todavía no tiene mensajes.
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
                            {formatDateTime(
                              message.createdAt,
                            )}
                          </small>
                        </div>
                      ),
                    )
                  )}
                </div>

                <footer className="nova-admin-chat__footer">
                  <span>
                    Vista de supervisión
                  </span>

                  <strong>
                    Los mensajes se responden desde la cuenta AGENT.
                  </strong>
                </footer>
              </div>
            ) : (
              <div className="nova-admin-chat nova-admin-chat--placeholder">
                <div className="nova-admin-chat-placeholder">
                  <div className="nova-admin-chat-placeholder__icon">
                    💬
                  </div>

                  <h2>
                    Selecciona una conversación
                  </h2>

                  <p>
                    Elige una conversación de la bandeja para revisar su historial.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </section>

      {notification ? (
        <div
          className="nova-admin-notification"
          role="status"
          aria-live="polite"
        >
          <div>
            <strong>
              ✓ Listo
            </strong>

            <span>
              {
                notification
              }
            </span>
          </div>

          <button
            type="button"
            aria-label="Cerrar notificación"
            onClick={() => {
              setNotification(
                null,
              );
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </main>
  );
}