import {
  useEffect,
  useState,
} from 'react';

import type {
  SyntheticEvent,
} from 'react';

import './App.css';

import {
  connectNovaSocket,
  getNovaMessages,
  getNovaSession,
  sendNovaTextMessage,
} from './nova';

import type {
  NovaMessage,
  NovaSession,
} from './nova';

function App() {
  const [
    connectionStatus,
    setConnectionStatus,
  ] = useState(
    'Conectando...',
  );

  const [
    session,
    setSession,
  ] =
    useState<NovaSession | null>(
      null,
    );

  const [
    messages,
    setMessages,
  ] =
    useState<NovaMessage[]>([]);

  const [
    input,
    setInput,
  ] = useState('');

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  function addMessage(
    message: NovaMessage,
  ) {
    setMessages(
      (currentMessages) => {
        const alreadyExists =
          currentMessages.some(
            (currentMessage) =>
              currentMessage.id ===
              message.id,
          );

        if (alreadyExists) {
          return currentMessages;
        }

        return [
          ...currentMessages,
          message,
        ].sort(
          (a, b) =>
            new Date(
              a.createdAt,
            ).getTime() -
            new Date(
              b.createdAt,
            ).getTime(),
        );
      },
    );
  }

  /*
   * Combina historial + mensajes que hayan
   * llegado por Socket mientras cargábamos.
   */
  function mergeMessages(
    history: NovaMessage[],
  ) {
    setMessages(
      (currentMessages) => {
        const byId =
          new Map<
            string,
            NovaMessage
          >();

        for (
          const message
          of history
        ) {
          byId.set(
            message.id,
            message,
          );
        }

        for (
          const message
          of currentMessages
        ) {
          byId.set(
            message.id,
            message,
          );
        }

        return Array.from(
          byId.values(),
        ).sort(
          (a, b) =>
            new Date(
              a.createdAt,
            ).getTime() -
            new Date(
              b.createdAt,
            ).getTime(),
        );
      },
    );
  }

  useEffect(() => {
    let socket:
      ReturnType<
        typeof connectNovaSocket
      > | null = null;

    let cancelled = false;

    async function initialize() {
      try {
        const novaSession =
          await getNovaSession();

        if (cancelled) {
          return;
        }

        console.log(
          'Nova session:',
          novaSession,
        );

        setSession(
          novaSession,
        );

        socket =
          connectNovaSocket(
            novaSession.visitorToken,
            novaSession.conversation.id,
            {
              async onJoined() {
                if (cancelled) {
                  return;
                }

                setConnectionStatus(
                  'En línea',
                );

                try {
                  const history =
                    await getNovaMessages(
                      novaSession.visitorToken,
                      novaSession.conversation.id,
                    );

                  if (cancelled) {
                    return;
                  }

                  console.log(
                    'Historial Nova:',
                    history,
                  );

                  mergeMessages(
                    history,
                  );
                } catch (err) {
                  console.error(
                    err,
                  );

                  if (
                    !cancelled
                  ) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'No se pudo cargar el historial',
                    );
                  }
                }
              },

              onMessage(message) {
                if (!cancelled) {
                  addMessage(
                    message,
                  );
                }
              },

              onDisconnect() {
                if (!cancelled) {
                  setConnectionStatus(
                    'Desconectado',
                  );
                }
              },

              onError(message) {
                if (!cancelled) {
                  setError(
                    message,
                  );
                }
              },
            },
          );
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Error al iniciar Nova',
          );

          setConnectionStatus(
            'Error',
          );
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;

      socket?.disconnect();
    };
  }, []);

  async function handleSubmit(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!session) {
      return;
    }

    const content =
      input.trim();

    if (!content) {
      return;
    }

    try {
      setSending(true);
      setError(null);

      const message =
        await sendNovaTextMessage(
          session.visitorToken,
          session.conversation.id,
          content,
        );

      addMessage(
        message,
      );

      setInput('');
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar el mensaje',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="nova-widget-page">
      <section className="nova-chat">
        <header className="nova-chat__header">
          <div>
            <h1>
              Nova
            </h1>

            <p>
              Soporte en línea
            </p>
          </div>

          <span className="nova-chat__status">
            {connectionStatus}
          </span>
        </header>

        <div className="nova-chat__messages">
          <div className="nova-message nova-message--system">
            Hola 👋 ¿En qué podemos ayudarte?
          </div>

          {messages.map(
            (message) => (
              <div
                key={
                  message.id
                }
                className={
                  message.senderType ===
                  'VISITOR'
                    ? 'nova-message nova-message--visitor'
                    : 'nova-message nova-message--agent'
                }
              >
                {message.type ===
                'IMAGE' ? (
                  <>
                    {message.mediaUrl && (
                      <img
                        src={
                          `http://localhost:3000${message.mediaUrl}`
                        }
                        alt="Imagen enviada"
                        className="nova-message__image"
                      />
                    )}

                    {message.content && (
                      <span>
                        {
                          message.content
                        }
                      </span>
                    )}
                  </>
                ) : (
                  message.content
                )}
              </div>
            ),
          )}

          {error && (
            <div className="nova-message nova-message--error">
              {error}
            </div>
          )}
        </div>

        <form
          className="nova-chat__composer"
          onSubmit={
            handleSubmit
          }
        >
          <input
            type="text"
            value={input}
            onChange={
              (event) =>
                setInput(
                  event.target.value,
                )
            }
            placeholder="Escribe un mensaje..."
            disabled={
              !session ||
              sending
            }
          />

          <button
            type="submit"
            disabled={
              !session ||
              sending ||
              !input.trim()
            }
          >
            {sending
              ? 'Enviando...'
              : 'Enviar'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;