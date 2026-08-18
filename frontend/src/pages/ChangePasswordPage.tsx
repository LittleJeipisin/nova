import {
  useState,
} from 'react';

import type {
  SyntheticEvent,
} from 'react';

import {
  changePassword,
  getMe,
  getStoredAccessToken,
  getValidAccessToken,
} from '../auth/auth';

import type {
  AuthUser,
} from '../auth/auth';

type ChangePasswordPageProps = {
  user: AuthUser;
  onPasswordChanged: (
    user: AuthUser,
  ) => void;
  onLogout: () => void;
};

export function ChangePasswordPage({
  user,
  onPasswordChanged,
  onLogout,
}: ChangePasswordPageProps) {
  const [
    currentPassword,
    setCurrentPassword,
  ] = useState('');

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  async function handleSubmit(
    event:
      SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      setError(
        'Completa todos los campos.',
      );

      return;
    }

    if (
      newPassword.length < 8
    ) {
      setError(
        'La nueva contraseña debe tener al menos 8 caracteres.',
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        'Las nuevas contraseñas no coinciden.',
      );

      return;
    }

    if (
      currentPassword ===
      newPassword
    ) {
      setError(
        'La nueva contraseña debe ser diferente a la contraseña temporal.',
      );

      return;
    }

    try {
      setSubmitting(
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

      await changePassword(
        accessToken,
        currentPassword,
        newPassword,
      );

      /*
       * Volvemos a consultar /auth/me
       * para obtener mustChangePassword
       * actualizado desde el backend.
       */
      const authenticatedUser =
        await getMe(
          accessToken,
        );

      onPasswordChanged(
        authenticatedUser,
      );
    } catch (err) {
      console.error(
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar la contraseña.',
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
            Cambia tu contraseña
          </h2>

          <p>
            Hola,{' '}
            <strong>
              {user.username}
            </strong>.
          </p>

          <p>
            Estás utilizando una
            contraseña temporal.
            Debes crear una contraseña
            personal antes de continuar.
          </p>
        </div>

        <form
          className="nova-login__form"
          onSubmit={
            handleSubmit
          }
        >
          <label>
            Contraseña temporal

            <input
              type="password"
              value={
                currentPassword
              }
              onChange={(
                event,
              ) => {
                setCurrentPassword(
                  event.target.value,
                );
              }}
              disabled={
                submitting
              }
              autoComplete="current-password"
              placeholder="Contraseña temporal"
            />
          </label>

          <label>
            Nueva contraseña

            <input
              type="password"
              value={
                newPassword
              }
              onChange={(
                event,
              ) => {
                setNewPassword(
                  event.target.value,
                );
              }}
              disabled={
                submitting
              }
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </label>

          <label>
            Confirmar nueva contraseña

            <input
              type="password"
              value={
                confirmPassword
              }
              onChange={(
                event,
              ) => {
                setConfirmPassword(
                  event.target.value,
                );
              }}
              disabled={
                submitting
              }
              autoComplete="new-password"
              placeholder="Repite la nueva contraseña"
            />
          </label>

          {error ? (
            <div
              className="nova-login__error"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={
              submitting ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
          >
            {submitting
              ? 'Cambiando...'
              : 'Cambiar contraseña'}
          </button>

          <button
            type="button"
            disabled={
              submitting
            }
            onClick={
              onLogout
            }
            style={{
              background:
                '#ffffff',
              color:
                '#374151',
              border:
                '1px solid #d1d5db',
            }}
          >
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  );
}