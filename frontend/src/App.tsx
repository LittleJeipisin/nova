import {
  useEffect,
  useState,
} from 'react';

import './App.css';

import {
  getMe,
  getStoredAccessToken,
  getValidAccessToken,
  logout,
} from './auth/auth';

import type {
  AuthUser,
} from './auth/auth';

import {
  InboxPage,
} from './pages/InboxPage';

import {
  LoginPage,
} from './pages/LoginPage';

function App() {
  const [
    user,
    setUser,
  ] = useState<AuthUser | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        /*
         * Puede ocurrir que:
         *
         * 1. exista un Access Token válido;
         * 2. exista uno vencido;
         * 3. no exista Access Token,
         *    pero sí la cookie HttpOnly
         *    del Refresh Token.
         *
         * getValidAccessToken cubre los
         * tres casos.
         */
        const storedAccessToken =
          getStoredAccessToken();

        const accessToken =
          await getValidAccessToken(
            storedAccessToken ??
              undefined,
          );

        const authenticatedUser =
          await getMe(
            accessToken,
          );

        if (cancelled) {
          return;
        }

        setUser(
          authenticatedUser,
        );
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        console.error(
          'No se pudo restaurar la sesión:',
          error,
        );

        /*
         * Si tampoco pudimos renovar
         * mediante Refresh Token,
         * mostramos el login.
         */
        setUser(
          null,
        );
      } finally {
        if (!cancelled) {
          setLoading(
            false,
          );
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleAuthenticated(
    authenticatedUser: AuthUser,
  ) {
    setUser(
      authenticatedUser,
    );
  }

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(
      true,
    );

    try {
      /*
       * POST /auth/logout:
       *
       * - revoca RefreshSession;
       * - elimina cookie HttpOnly;
       * - elimina Access Token local.
       */
      await logout();
    } catch (error: unknown) {
      console.error(
        'Error cerrando sesión:',
        error,
      );
    } finally {
      setUser(
        null,
      );

      setLoggingOut(
        false,
      );
    }
  }

  if (loading) {
    return (
      <main className="nova-loading">
        Cargando Nova...
      </main>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onAuthenticated={
          handleAuthenticated
        }
      />
    );
  }

  if (user.role === 'AGENT') {
    return (
      <InboxPage
        user={user}
        onLogout={
          handleLogout
        }
      />
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
            Nova
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
            onClick={() => {
              void handleLogout();
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

      <section className="nova-dashboard__content">
        <div className="nova-dashboard__welcome">
          <h1>
            Bienvenido a Nova
          </h1>

          <p>
            Tu sesión está autenticada correctamente.
          </p>

          <dl>
            <div>
              <dt>
                Usuario
              </dt>

              <dd>
                {user.username}
              </dd>
            </div>

            <div>
              <dt>
                Rol
              </dt>

              <dd>
                {user.role}
              </dd>
            </div>

            <div>
              <dt>
                Workspace
              </dt>

              <dd>
                {user.workspaceId ??
                  'Plataforma'}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}

export default App;