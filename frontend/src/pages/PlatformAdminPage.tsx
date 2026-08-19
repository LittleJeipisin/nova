import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  SyntheticEvent,
} from 'react';

import {
  getStoredAccessToken,
  getValidAccessToken,
} from '../auth/auth';

import type {
  AuthUser,
} from '../auth/auth';

import {
  getWorkspaceUsers,
} from '../lib/api';

import type {
  WorkspaceUser,
} from '../lib/api';

import {
  activatePlatformWorkspace,
  createPlatformWorkspace,
  createWorkspaceOwner,
  deactivatePlatformWorkspace,
  getPlatformWorkspaces,
} from '../lib/platform-api';

import type {
  CreatedOwner,
  PlatformWorkspace,
} from '../lib/platform-api';

import './PlatformAdminPage.css';

type PlatformAdminPageProps = {
  user: AuthUser;

  onLogout:
    () => void | Promise<void>;

  loggingOut: boolean;
};

function formatDate(
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
        'numeric',
    },
  ).format(
    new Date(
      value,
    ),
  );
}

export function PlatformAdminPage({
  user,
  onLogout,
  loggingOut,
}: PlatformAdminPageProps) {
  const [
    workspaces,
    setWorkspaces,
  ] =
    useState<
      PlatformWorkspace[]
    >([]);

  const [
    selectedWorkspaceId,
    setSelectedWorkspaceId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    workspaceUsers,
    setWorkspaceUsers,
  ] =
    useState<
      WorkspaceUser[]
    >([]);

  const [
    workspaceName,
    setWorkspaceName,
  ] =
    useState('');

  const [
    ownerUsername,
    setOwnerUsername,
  ] =
    useState('');

  const [
    createdOwner,
    setCreatedOwner,
  ] =
    useState<
      CreatedOwner | null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    creatingWorkspace,
    setCreatingWorkspace,
  ] =
    useState(
      false,
    );

  const [
    creatingOwner,
    setCreatingOwner,
  ] =
    useState(
      false,
    );

  const [
    changingWorkspaceStatus,
    setChangingWorkspaceStatus,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    notification,
    setNotification,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const getAccessToken =
    useCallback(
      async () => {
        return getValidAccessToken(
          getStoredAccessToken() ??
            undefined,
        );
      },
      [],
    );

  const refreshWorkspaces =
    useCallback(
      async () => {
        const accessToken =
          await getAccessToken();

        const result =
          await getPlatformWorkspaces(
            accessToken,
          );

        setWorkspaces(
          result,
        );

        setSelectedWorkspaceId(
          (
            current,
          ) => {
            if (
              current &&
              result.some(
                (
                  workspace,
                ) =>
                  workspace.id ===
                  current,
              )
            ) {
              return current;
            }

            return (
              result[0]?.id ??
              null
            );
          },
        );

        return result;
      },
      [
        getAccessToken,
      ],
    );

  const refreshWorkspaceUsers =
    useCallback(
      async (
        workspaceId:
          string,
      ) => {
        const accessToken =
          await getAccessToken();

        const result =
          await getWorkspaceUsers(
            accessToken,
            workspaceId,
          );

        setWorkspaceUsers(
          result,
        );
      },
      [
        getAccessToken,
      ],
    );

  /*
   * Carga inicial de Workspaces.
   */
  useEffect(
    () => {
      let cancelled =
        false;

      async function load() {
        try {
          setLoading(
            true,
          );

          setError(
            null,
          );

          const accessToken =
            await getAccessToken();

          const result =
            await getPlatformWorkspaces(
              accessToken,
            );

          if (
            cancelled
          ) {
            return;
          }

          setWorkspaces(
            result,
          );

          setSelectedWorkspaceId(
            result[0]?.id ??
              null,
          );
        } catch (
          err
        ) {
          console.error(
            err,
          );

          if (
            cancelled
          ) {
            return;
          }

          setError(
            err instanceof
              Error
              ? err.message
              : 'No se pudo cargar la plataforma',
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

      void load();

      return () => {
        cancelled =
          true;
      };
    },
    [
      getAccessToken,
    ],
  );

  /*
   * Carga los usuarios del Workspace
   * seleccionado.
   *
   * IMPORTANTE:
   * No hacemos setState síncrono
   * directamente al comienzo del
   * effect para evitar:
   *
   * react-hooks/set-state-in-effect
   */
  useEffect(
    () => {
      if (
        !selectedWorkspaceId
      ) {
        return;
      }

      const workspaceId =
        selectedWorkspaceId;

      let cancelled =
        false;

      async function loadUsers() {
        try {
          const accessToken =
            await getAccessToken();

          const result =
            await getWorkspaceUsers(
              accessToken,
              workspaceId,
            );

          if (
            cancelled
          ) {
            return;
          }

          setWorkspaceUsers(
            result,
          );
        } catch (
          err
        ) {
          console.error(
            err,
          );

          if (
            cancelled
          ) {
            return;
          }

          setError(
            err instanceof
              Error
              ? err.message
              : 'No se pudieron cargar los usuarios',
          );
        }
      }

      void loadUsers();

      return () => {
        cancelled =
          true;
      };
    },
    [
      getAccessToken,
      selectedWorkspaceId,
    ],
  );

  /*
   * Toast temporal.
   */
  useEffect(
    () => {
      if (
        !notification
      ) {
        return;
      }

      const timeout =
        window.setTimeout(
          () => {
            setNotification(
              null,
            );
          },
          4000,
        );

      return () => {
        window.clearTimeout(
          timeout,
        );
      };
    },
    [
      notification,
    ],
  );

  const selectedWorkspace =
    useMemo(
      () =>
        workspaces.find(
          (
            workspace,
          ) =>
            workspace.id ===
            selectedWorkspaceId,
        ) ??
        null,
      [
        selectedWorkspaceId,
        workspaces,
      ],
    );

  const owners =
    useMemo(
      () =>
        workspaceUsers.filter(
          (
            workspaceUser,
          ) =>
            workspaceUser.role ===
            'OWNER',
        ),
      [
        workspaceUsers,
      ],
    );

  const activeWorkspaceCount =
    useMemo(
      () =>
        workspaces.filter(
          (
            workspace,
          ) =>
            workspace.status ===
            'ACTIVE',
        ).length,
      [
        workspaces,
      ],
    );

  const inactiveWorkspaceCount =
    workspaces.length -
    activeWorkspaceCount;

  const totalUsers =
    workspaces.reduce(
      (
        total,
        workspace,
      ) =>
        total +
        workspace.userCount,
      0,
    );

  async function handleCreateWorkspace(
    event:
      SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanName =
      workspaceName.trim();

    if (
      !cleanName ||
      creatingWorkspace
    ) {
      return;
    }

    try {
      setCreatingWorkspace(
        true,
      );

      setError(
        null,
      );

      setCreatedOwner(
        null,
      );

      const accessToken =
        await getAccessToken();

      const workspace =
        await createPlatformWorkspace(
          accessToken,
          cleanName,
        );

      await refreshWorkspaces();

      setSelectedWorkspaceId(
        workspace.id,
      );

      setWorkspaceName(
        '',
      );

      setNotification(
        'Workspace creado correctamente.',
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
          : 'No se pudo crear el workspace',
      );
    } finally {
      setCreatingWorkspace(
        false,
      );
    }
  }

  async function handleCreateOwner(
    event:
      SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !selectedWorkspace ||
      selectedWorkspace.status !==
        'ACTIVE'
    ) {
      return;
    }

    const cleanUsername =
      ownerUsername.trim();

    if (
      !cleanUsername ||
      creatingOwner
    ) {
      return;
    }

    try {
      setCreatingOwner(
        true,
      );

      setError(
        null,
      );

      const accessToken =
        await getAccessToken();

      const owner =
        await createWorkspaceOwner(
          accessToken,
          selectedWorkspace.id,
          cleanUsername,
        );

      setCreatedOwner(
        owner,
      );

      setOwnerUsername(
        '',
      );

      await Promise.all([
        refreshWorkspaceUsers(
          selectedWorkspace.id,
        ),

        refreshWorkspaces(),
      ]);

      setNotification(
        'OWNER creado correctamente.',
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
          : 'No se pudo crear el owner',
      );
    } finally {
      setCreatingOwner(
        false,
      );
    }
  }

  async function handleToggleWorkspace(
    workspace:
      PlatformWorkspace,
  ) {
    if (
      changingWorkspaceStatus
    ) {
      return;
    }

    try {
      setChangingWorkspaceStatus(
        workspace.id,
      );

      setError(
        null,
      );

      const accessToken =
        await getAccessToken();

      if (
        workspace.status ===
        'ACTIVE'
      ) {
        await deactivatePlatformWorkspace(
          accessToken,
          workspace.id,
        );

        setNotification(
          'Workspace desactivado.',
        );
      } else {
        await activatePlatformWorkspace(
          accessToken,
          workspace.id,
        );

        setNotification(
          'Workspace reactivado.',
        );
      }

      await refreshWorkspaces();
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
          : 'No se pudo cambiar el estado del workspace',
      );
    } finally {
      setChangingWorkspaceStatus(
        null,
      );
    }
  }

  if (
    loading
  ) {
    return (
      <main className="nova-platform-loading">
        <div className="nova-platform-loading__logo">
          N
        </div>

        <span>
          Cargando plataforma...
        </span>
      </main>
    );
  }

  return (
    <main className="nova-platform">
      <header className="nova-platform__topbar">
        <div className="nova-platform__brand">
          <div className="nova-platform__logo">
            N
          </div>

          <div>
            <strong>
              Nova
            </strong>

            <span>
              Administración de plataforma
            </span>
          </div>
        </div>

        <div className="nova-platform__user">
          <div>
            <strong>
              {
                user.username
              }
            </strong>

            <span>
              PLATFORM ADMIN
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              void onLogout();
            }}
            disabled={
              loggingOut
            }
          >
            {loggingOut
              ? 'Cerrando...'
              : 'Cerrar sesión'}
          </button>
        </div>
      </header>

      <div className="nova-platform__shell">
        <div className="nova-platform__heading">
          <div>
            <span className="nova-platform__eyebrow">
              Plataforma Nova
            </span>

            <h1>
              Workspaces
            </h1>

            <p>
              Administra empresas y crea sus cuentas OWNER.
            </p>
          </div>
        </div>

        {error ? (
          <div
            className="nova-platform__error"
            role="alert"
          >
            <span>
              !
            </span>

            {
              error
            }
          </div>
        ) : null}

        <section className="nova-platform__stats">
          <article>
            <span>
              Total
            </span>

            <strong>
              {
                workspaces.length
              }
            </strong>

            <small>
              Workspaces
            </small>
          </article>

          <article>
            <span>
              Activos
            </span>

            <strong>
              {
                activeWorkspaceCount
              }
            </strong>

            <small>
              En operación
            </small>
          </article>

          <article>
            <span>
              Inactivos
            </span>

            <strong>
              {
                inactiveWorkspaceCount
              }
            </strong>

            <small>
              Suspendidos
            </small>
          </article>

          <article>
            <span>
              Usuarios
            </span>

            <strong>
              {
                totalUsers
              }
            </strong>

            <small>
              En plataforma
            </small>
          </article>
        </section>

        <section className="nova-platform__grid">
          <article className="nova-platform-panel">
            <div className="nova-platform-panel__header">
              <div>
                <h2>
                  Empresas
                </h2>

                <p>
                  Workspaces registrados en Nova.
                </p>
              </div>

              <span className="nova-platform-panel__count">
                {
                  workspaces.length
                }
              </span>
            </div>

            <form
              className="nova-platform-form"
              onSubmit={
                handleCreateWorkspace
              }
            >
              <label>
                Nombre del workspace

                <div className="nova-platform-form__row">
                  <input
                    type="text"
                    value={
                      workspaceName
                    }
                    onChange={(
                      event,
                    ) => {
                      setWorkspaceName(
                        event.target.value,
                      );
                    }}
                    placeholder="Ej: Empresa Demo"
                    disabled={
                      creatingWorkspace
                    }
                  />

                  <button
                    type="submit"
                    disabled={
                      creatingWorkspace ||
                      !workspaceName.trim()
                    }
                  >
                    {creatingWorkspace
                      ? 'Creando...'
                      : 'Crear workspace'}
                  </button>
                </div>
              </label>
            </form>

            <div className="nova-platform-workspaces">
              {workspaces.length ===
              0 ? (
                <div className="nova-platform-empty">
                  <div>
                    N
                  </div>

                  <strong>
                    Aún no hay workspaces
                  </strong>

                  <span>
                    Crea el primero usando el formulario superior.
                  </span>
                </div>
              ) : (
                workspaces.map(
                  (
                    workspace,
                  ) => {
                    const selected =
                      workspace.id ===
                      selectedWorkspaceId;

                    return (
                      <div
                        key={
                          workspace.id
                        }
                        className={
                          selected
                            ? 'nova-platform-workspace nova-platform-workspace--selected'
                            : 'nova-platform-workspace'
                        }
                      >
                        <button
                          type="button"
                          className="nova-platform-workspace__select"
                          onClick={() => {
                            setSelectedWorkspaceId(
                              workspace.id,
                            );

                            setCreatedOwner(
                              null,
                            );
                          }}
                        >
                          <div className="nova-platform-workspace__avatar">
                            {workspace.name
                              .charAt(
                                0,
                              )
                              .toUpperCase()}
                          </div>

                          <div className="nova-platform-workspace__content">
                            <div className="nova-platform-workspace__title">
                              <strong>
                                {
                                  workspace.name
                                }
                              </strong>

                              <span
                                className={
                                  workspace.status ===
                                  'ACTIVE'
                                    ? 'nova-platform-status nova-platform-status--active'
                                    : 'nova-platform-status nova-platform-status--inactive'
                                }
                              >
                                {workspace.status ===
                                'ACTIVE'
                                  ? 'Activo'
                                  : 'Inactivo'}
                              </span>
                            </div>

                            <span className="nova-platform-workspace__slug">
                              /{
                                workspace.slug
                              }
                            </span>

                            <span className="nova-platform-workspace__meta">
                              {
                                workspace.userCount
                              }{' '}
                              usuario
                              {workspace.userCount ===
                              1
                                ? ''
                                : 's'}
                              {' · '}
                              Creado{' '}
                              {formatDate(
                                workspace.createdAt,
                              )}
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          className={
                            workspace.status ===
                            'ACTIVE'
                              ? 'nova-platform-workspace__action nova-platform-workspace__action--danger'
                              : 'nova-platform-workspace__action'
                          }
                          disabled={
                            changingWorkspaceStatus ===
                            workspace.id
                          }
                          onClick={() => {
                            void handleToggleWorkspace(
                              workspace,
                            );
                          }}
                        >
                          {changingWorkspaceStatus ===
                          workspace.id
                            ? '...'
                            : workspace.status ===
                                'ACTIVE'
                              ? 'Desactivar'
                              : 'Reactivar'}
                        </button>
                      </div>
                    );
                  },
                )
              )}
            </div>
          </article>

          <article className="nova-platform-panel">
            <div className="nova-platform-panel__header">
              <div>
                <h2>
                  OWNER
                </h2>

                <p>
                  Cuenta principal del workspace seleccionado.
                </p>
              </div>
            </div>

            {!selectedWorkspace ? (
              <div className="nova-platform-empty nova-platform-empty--owner">
                <div>
                  N
                </div>

                <strong>
                  Selecciona un workspace
                </strong>

                <span>
                  Aquí podrás crear y revisar sus OWNER.
                </span>
              </div>
            ) : (
              <>
                <div className="nova-platform-selected">
                  <div className="nova-platform-selected__avatar">
                    {selectedWorkspace.name
                      .charAt(
                        0,
                      )
                      .toUpperCase()}
                  </div>

                  <div>
                    <span>
                      Workspace seleccionado
                    </span>

                    <strong>
                      {
                        selectedWorkspace.name
                      }
                    </strong>

                    <small>
                      {
                        selectedWorkspace.slug
                      }
                    </small>
                  </div>
                </div>

                {selectedWorkspace.status ===
                'ACTIVE' ? (
                  <form
                    className="nova-platform-owner-form"
                    onSubmit={
                      handleCreateOwner
                    }
                  >
                    <label>
                      Usuario del OWNER

                      <input
                        type="text"
                        value={
                          ownerUsername
                        }
                        onChange={(
                          event,
                        ) => {
                          setOwnerUsername(
                            event.target.value,
                          );
                        }}
                        placeholder="owner_empresa"
                        disabled={
                          creatingOwner
                        }
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={
                        creatingOwner ||
                        !ownerUsername.trim()
                      }
                    >
                      {creatingOwner
                        ? 'Creando OWNER...'
                        : 'Crear OWNER'}
                    </button>
                  </form>
                ) : (
                  <div className="nova-platform-warning">
                    Este workspace está inactivo. Reactívalo antes de crear usuarios.
                  </div>
                )}

                {createdOwner ? (
                  <div className="nova-platform-credentials">
                    <div className="nova-platform-credentials__icon">
                      ✓
                    </div>

                    <div className="nova-platform-credentials__content">
                      <strong>
                        OWNER creado
                      </strong>

                      <span>
                        Guarda estas credenciales. La contraseña se muestra una sola vez.
                      </span>

                      <div className="nova-platform-credentials__values">
                        <div>
                          <small>
                            Usuario
                          </small>

                          <code>
                            {
                              createdOwner.username
                            }
                          </code>
                        </div>

                        <div>
                          <small>
                            Contraseña temporal
                          </small>

                          <code>
                            {
                              createdOwner.password
                            }
                          </code>
                        </div>

                        <div>
                          <small>
                            URL local
                          </small>

                          <code>
                            {`${window.location.origin}/?workspace=${selectedWorkspace.slug}`}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="nova-platform-owner-list">
                  <div className="nova-platform-owner-list__heading">
                    <strong>
                      OWNER registrados
                    </strong>

                    <span>
                      {
                        owners.length
                      }
                    </span>
                  </div>

                  {owners.length ===
                  0 ? (
                    <div className="nova-platform-owner-empty">
                      Este workspace todavía no tiene OWNER.
                    </div>
                  ) : (
                    owners.map(
                      (
                        owner,
                      ) => (
                        <div
                          key={
                            owner.id
                          }
                          className="nova-platform-owner"
                        >
                          <div className="nova-platform-owner__avatar">
                            O
                          </div>

                          <div>
                            <strong>
                              {
                                owner.username
                              }
                            </strong>

                            <span>
                              {owner.ownerType ===
                              'TEMPORARY'
                                ? 'OWNER temporal'
                                : 'OWNER permanente'}
                            </span>
                          </div>

                          <span
                            className={
                              owner.status ===
                              'ACTIVE'
                                ? 'nova-platform-status nova-platform-status--active'
                                : 'nova-platform-status nova-platform-status--inactive'
                            }
                          >
                            {owner.status ===
                            'ACTIVE'
                              ? 'Activo'
                              : 'Inactivo'}
                          </span>
                        </div>
                      ),
                    )
                  )}
                </div>
              </>
            )}
          </article>
        </section>
      </div>

      {notification ? (
        <div
          className="nova-platform-toast"
          role="status"
        >
          <span>
            ✓
          </span>

          {
            notification
          }
        </div>
      ) : null}
    </main>
  );
}