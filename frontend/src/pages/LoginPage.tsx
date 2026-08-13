import { useState } from 'react';

import type { SyntheticEvent } from 'react';

import {
  clearAccessToken,
  getMe,
  login,
  saveAccessToken,
} from '../auth/auth';

import type { AuthUser } from '../auth/auth';

type LoginPageProps = {
  onAuthenticated: (user: AuthUser) => void;
};

const workspaceSlug =
  new URLSearchParams(window.location.search)
    .get('workspace')
    ?.trim() ?? '';

export function LoginPage({
  onAuthenticated,
}: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!workspaceSlug) {
      setError(
        'No se pudo determinar el espacio de trabajo.',
      );

      return;
    }

    if (!username.trim() || !password) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const loginResult = await login({
        username: username.trim(),
        password,
        workspaceSlug,
      });

      saveAccessToken(loginResult.accessToken);

      try {
        const user = await getMe(
          loginResult.accessToken,
        );

        onAuthenticated(user);
      } catch (err) {
        clearAccessToken();

        throw err;
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar sesión',
      );
    } finally {
      setSubmitting(false);
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
            <h1>Nova</h1>

            <p>Panel de atención</p>
          </div>
        </div>

        <div className="nova-login__heading">
          <h2>Iniciar sesión</h2>

          <p>
            Ingresa con tus credenciales.
          </p>
        </div>

        <form
          className="nova-login__form"
          onSubmit={handleSubmit}
        >
          <label>
            Usuario

            <input
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
              }}
              placeholder="Usuario"
              disabled={submitting}
              autoComplete="username"
            />
          </label>

          <label>
            Contraseña

            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Tu contraseña"
              disabled={submitting}
              autoComplete="current-password"
            />
          </label>

          {error && (
            <div
              className="nova-login__error"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              !workspaceSlug ||
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