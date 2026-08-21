import {
  useState,
} from 'react';

import type {
  SyntheticEvent,
} from 'react';

import {
  clearAccessToken,
  getMe,
  login,
  saveAccessToken,
} from '../auth/auth';

import type {
  AuthUser,
} from '../auth/auth';

import {
  getWorkspaceSlugFromPath,
} from '../lib/workspace-route';

type LoginPageProps = {
  onAuthenticated: (
    user: AuthUser,
  ) => void;
};

export function LoginPage({
  onAuthenticated,
}: LoginPageProps) {
  const [
    username,
    setUsername,
  ] =
    useState('');

  const [
    password,
    setPassword,
  ] =
    useState('');

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(
      false,
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(
      false,
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

  const workspaceSlug =
    getWorkspaceSlugFromPath();

  async function handleSubmit(
    event:
      SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !username.trim() ||
      !password
    ) {
      return;
    }

    try {
      setSubmitting(
        true,
      );

      setError(
        null,
      );

      /*
       * /
       *   → sin workspaceSlug
       *   → exclusivamente PLATFORM_ADMIN
       *
       * /alpha
       *   → workspaceSlug = alpha
       *   → usuarios del Workspace alpha
       */
      const loginResult =
        await login({
          username:
            username.trim(),

          password,

          workspaceSlug:
            workspaceSlug ??
            undefined,
        });

      saveAccessToken(
        loginResult.accessToken,
      );

      try {
        const user =
          await getMe(
            loginResult.accessToken,
          );

        onAuthenticated(
          user,
        );
      } catch (
        err
      ) {
        clearAccessToken();

        throw err;
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
          : 'No se pudo iniciar sesión',
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  return (
    <main className="nova-login-page">
      <section className="nova-login">
        <div className="nova-login__brand">
          <div className="nova-login__logo">
            N
          </div>

          <div>
            <h1>
              Nova
            </h1>

            <p>
              Panel de atención
            </p>
          </div>
        </div>

        <div className="nova-login__heading">
          <h2>
            Iniciar sesión
          </h2>

          <p>
            {workspaceSlug
              ? `Acceso a ${workspaceSlug}`
              : 'Acceso de plataforma'}
          </p>
        </div>

        <form
          className="nova-login__form"
          onSubmit={
            handleSubmit
          }
        >
          <label>
            Usuario

            <input
              type="text"
              value={
                username
              }
              onChange={(
                event,
              ) => {
                setUsername(
                  event.target.value,
                );
              }}
              placeholder="Usuario"
              disabled={
                submitting
              }
              autoComplete="username"
            />
          </label>

          <label>
            Contraseña

            <div className="nova-login__password-field">
              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={
                  password
                }
                onChange={(
                  event,
                ) => {
                  setPassword(
                    event.target.value,
                  );
                }}
                placeholder="Tu contraseña"
                disabled={
                  submitting
                }
                autoComplete="current-password"
              />

              <button
                type="button"
                className="nova-login__password-toggle"
                onClick={() => {
                  setShowPassword(
                    (
                      currentValue,
                    ) =>
                      !currentValue,
                  );
                }}
                disabled={
                  submitting
                }
                aria-label={
                  showPassword
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña'
                }
                aria-pressed={
                  showPassword
                }
                title={
                  showPassword
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña'
                }
              >
                {showPassword ? (
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 3l18 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />

                    <path
                      d="M10.6 10.6a2 2 0 002.8 2.8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />

                    <path
                      d="M9.9 4.3A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a15.7 15.7 0 01-3.1 3.5M6.6 6.6C4.2 8 3 10 3 10s3.5 5 9 5c1 0 2-.2 2.9-.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {error ? (
            <div
              className="nova-login__error"
              role="alert"
            >
              {
                error
              }
            </div>
          ) : null}

          <button
            type="submit"
            disabled={
              submitting ||
              !username.trim() ||
              !password
            }
          >
            {submitting
              ? 'Ingresando...'
              : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}