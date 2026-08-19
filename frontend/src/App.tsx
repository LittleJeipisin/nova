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
  AdminPage,
} from './pages/AdminPage';

import {
  ChangePasswordPage,
} from './pages/ChangePasswordPage';

import {
  InboxPage,
} from './pages/InboxPage';

import {
  LoginPage,
} from './pages/LoginPage';

import {
  PlatformAdminPage,
} from './pages/PlatformAdminPage';

function App() {
  const [
    user,
    setUser,
  ] =
    useState<
      AuthUser | null
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
    loggingOut,
    setLoggingOut,
  ] =
    useState(
      false,
    );

  useEffect(
    () => {
      let cancelled =
        false;

      async function restoreSession() {
        try {
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

          if (
            cancelled
          ) {
            return;
          }

          setUser(
            authenticatedUser,
          );
        } catch (
          error:
            unknown
        ) {
          if (
            cancelled
          ) {
            return;
          }

          console.error(
            'No se pudo restaurar la sesión:',
            error,
          );

          setUser(
            null,
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

      void restoreSession();

      return () => {
        cancelled =
          true;
      };
    },
    [],
  );

  function handleAuthenticated(
    authenticatedUser:
      AuthUser,
  ) {
    setUser(
      authenticatedUser,
    );
  }

  async function handleLogout() {
    if (
      loggingOut
    ) {
      return;
    }

    setLoggingOut(
      true,
    );

    try {
      await logout();
    } catch (
      error:
        unknown
    ) {
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

  if (
    loading
  ) {
    return (
      <main className="nova-loading">
        Cargando Nova...
      </main>
    );
  }

  if (
    !user
  ) {
    return (
      <LoginPage
        onAuthenticated={
          handleAuthenticated
        }
      />
    );
  }

  if (
    user.mustChangePassword
  ) {
    return (
      <ChangePasswordPage
        user={
          user
        }
        onPasswordChanged={
          handleAuthenticated
        }
        onLogout={
          handleLogout
        }
      />
    );
  }

  if (
    user.role ===
    'PLATFORM_ADMIN'
  ) {
    return (
      <PlatformAdminPage
        user={
          user
        }
        onLogout={
          handleLogout
        }
        loggingOut={
          loggingOut
        }
      />
    );
  }

  if (
    user.role ===
    'AGENT'
  ) {
    return (
      <InboxPage
        user={
          user
        }
        onLogout={
          handleLogout
        }
      />
    );
  }

  if (
    user.role ===
      'OWNER' ||
    user.role ===
      'ADMIN'
  ) {
    return (
      <AdminPage
        user={
          user
        }
        onLogout={
          handleLogout
        }
      />
    );
  }

  return (
    <main className="nova-loading">
      Rol no compatible.
    </main>
  );
}

export default App;