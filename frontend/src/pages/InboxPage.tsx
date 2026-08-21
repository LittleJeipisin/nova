import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  ChangeEvent,
  KeyboardEvent,
  SyntheticEvent,
} from 'react';

import type {
  Socket,
} from 'socket.io-client';

import {
  getStoredAccessToken,
  NOVA_API_URL,
} from '../auth/auth';

import type {
  AuthUser,
} from '../auth/auth';

import {
  claimConversation,
  closeConversation,
  getConversation,
  getConversations,
  sendAgentImageMessage,
  sendAgentTextMessage,
  updateConversationStatus,
} from '../lib/api';

import {
  connectAgentSocket,
  joinAgentConversation,
} from '../lib/socket';

import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
} from '../types/chat';

type InboxPageProps = {
  user: AuthUser;
  onLogout: () => void;
};

type InboxNotification = {
  type:
    | 'success'
    | 'warning';

  title: string;
  message: string;
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

function sortMessages(
  messages:
    ChatMessage[],
) {
  return [
    ...messages,
  ].sort(
    (
      a,
      b,
    ) =>
      new Date(
        a.createdAt,
      ).getTime() -
      new Date(
        b.createdAt,
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

function getLastMessage(
  conversation:
    ConversationSummary,
) {
  const message =
    conversation.messages[0];

  if (!message) {
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

  if (
    message.type ===
    'AUDIO'
  ) {
    return message.content
      ? `🎤 ${message.content}`
      : '🎤 Audio';
  }

  return (
    message.content ??
    'Mensaje'
  );
}

function AppStatus({
  status,
}: {
  status:
    ConversationSummary['status'];
}) {
  if (
    status ===
    'OPEN'
  ) {
    return (
      <span className="nova-inbox__status nova-inbox__status--open">
        Abierta
      </span>
    );
  }

  if (
    status ===
    'PENDING'
  ) {
    return (
      <span className="nova-inbox__status nova-inbox__status--pending">
        Pendiente
      </span>
    );
  }

  return (
    <span className="nova-inbox__status nova-inbox__status--closed">
      Cerrada
    </span>
  );
}

export function InboxPage({
  user,
  onLogout,
}: InboxPageProps) {
  const workspaceId =
    user.workspaceId ??
    '';

  const [
    conversations,
    setConversations,
  ] =
    useState<
      ConversationSummary[]
    >([]);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] =
    useState<
      string | null
    >(null);

  const [
    activeConversation,
    setActiveConversation,
  ] =
    useState<
      ConversationDetail | null
    >(null);

  const [
    loadingConversations,
    setLoadingConversations,
  ] =
    useState(
      true,
    );

  const [
    loadingConversation,
    setLoadingConversation,
  ] =
    useState(
      false,
    );

  const [
    claimingConversationId,
    setClaimingConversationId,
  ] =
    useState<
      string | null
    >(null);

  const [
    socketStatus,
    setSocketStatus,
  ] =
    useState(
      'Conectando...',
    );

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
      InboxNotification | null
    >(null);

  const [
    composerText,
    setComposerText,
  ] =
    useState('');

  const [
    selectedImage,
    setSelectedImage,
  ] =
    useState<
      File | null
    >(null);

  const [
    imagePreviewUrl,
    setImagePreviewUrl,
  ] =
    useState<
      string | null
    >(null);

  const [
    sendingMessage,
    setSendingMessage,
  ] =
    useState(
      false,
    );

  const [
    conversationAction,
    setConversationAction,
  ] =
    useState<
      | 'OPEN'
      | 'PENDING'
      | 'CLOSED'
      | null
    >(null);

  const socketRef =
    useRef<
      Socket | null
    >(null);

  const selectedConversationIdRef =
    useRef<
      string | null
    >(null);

  const conversationsRef =
    useRef<
      ConversationSummary[]
    >([]);

  const claimingConversationIdRef =
    useRef<
      string | null
    >(null);

  const claimProtectionTimeoutRef =
    useRef<
      number | null
    >(null);

  const assignedConversationProtectionRef =
    useRef<
      string | null
    >(null);

  const assignedConversationProtectionTimeoutRef =
    useRef<
      number | null
    >(null);

  const notificationTimeoutRef =
    useRef<
      number | null
    >(null);

  const messagesContainerRef =
    useRef<
      HTMLDivElement | null
    >(null);

  const fileInputRef =
    useRef<
      HTMLInputElement | null
    >(null);

  const imagePreviewUrlRef =
    useRef<
      string | null
    >(null);

  useEffect(
    () => {
      conversationsRef.current =
        conversations;
    },
    [
      conversations,
    ],
  );

  const resetComposer =
    useCallback(
      () => {
        setComposerText(
          '',
        );

        setSelectedImage(
          null,
        );

        if (
          imagePreviewUrlRef
            .current
        ) {
          URL.revokeObjectURL(
            imagePreviewUrlRef
              .current,
          );

          imagePreviewUrlRef.current =
            null;
        }

        setImagePreviewUrl(
          null,
        );

        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            '';
        }
      },
      [],
    );

  const showNotification =
    useCallback(
      (
        nextNotification:
          InboxNotification,
      ) => {
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
          nextNotification,
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
      },
      [],
    );

  const clearClaimProtection =
    useCallback(
      (
        conversationId?:
          string,
      ) => {
        if (
          conversationId &&
          claimingConversationIdRef
            .current !==
            conversationId
        ) {
          return;
        }

        claimingConversationIdRef.current =
          null;

        setClaimingConversationId(
          null,
        );

        if (
          claimProtectionTimeoutRef
            .current !==
          null
        ) {
          window.clearTimeout(
            claimProtectionTimeoutRef
              .current,
          );

          claimProtectionTimeoutRef.current =
            null;
        }
      },
      [],
    );

  const clearAssignedConversationProtection =
    useCallback(
      (
        conversationId?:
          string,
      ) => {
        if (
          conversationId &&
          assignedConversationProtectionRef
            .current !==
            conversationId
        ) {
          return;
        }

        assignedConversationProtectionRef.current =
          null;

        if (
          assignedConversationProtectionTimeoutRef
            .current !==
          null
        ) {
          window.clearTimeout(
            assignedConversationProtectionTimeoutRef
              .current,
          );

          assignedConversationProtectionTimeoutRef.current =
            null;
        }
      },
      [],
    );

  const protectAssignedConversation =
    useCallback(
      (
        conversationId:
          string,
      ) => {
        if (
          assignedConversationProtectionTimeoutRef
            .current !==
          null
        ) {
          window.clearTimeout(
            assignedConversationProtectionTimeoutRef
              .current,
          );
        }

        assignedConversationProtectionRef.current =
          conversationId;

        assignedConversationProtectionTimeoutRef.current =
          window.setTimeout(
            () => {
              clearAssignedConversationProtection(
                conversationId,
              );
            },
            5000,
          );
      },
      [
        clearAssignedConversationProtection,
      ],
    );

  const upsertConversation =
    useCallback(
      (
        conversation:
          ConversationSummary,
      ) => {
        const withoutCurrent =
          conversationsRef.current.filter(
            (
              current,
            ) =>
              current.id !==
              conversation.id,
          );

        const nextConversations =
          sortConversations([
            conversation,
            ...withoutCurrent,
          ]);

        conversationsRef.current =
          nextConversations;

        setConversations(
          nextConversations,
        );

        setActiveConversation(
          (
            current,
          ) => {
            if (
              !current ||
              current.id !==
                conversation.id
            ) {
              return current;
            }

            return {
              ...current,

              status:
                conversation.status,

              assignedAgentId:
                conversation
                  .assignedAgentId,

              assignedAgent:
                conversation
                  .assignedAgent,

              updatedAt:
                conversation.updatedAt,

              closedAt:
                conversation.closedAt,
            };
          },
        );
      },
      [],
    );

  const applyConversationStateUpdate =
    useCallback(
      (
        conversation:
          ConversationSummary,
      ) => {
        const nextConversations =
          sortConversations(
            conversationsRef.current.map(
              (
                current,
              ) => {
                if (
                  current.id !==
                  conversation.id
                ) {
                  return current;
                }

                return {
                  ...current,

                  status:
                    conversation.status,

                  updatedAt:
                    conversation.updatedAt,

                  closedAt:
                    conversation.closedAt,
                };
              },
            ),
          );

        conversationsRef.current =
          nextConversations;

        setConversations(
          nextConversations,
        );

        setActiveConversation(
          (
            current,
          ) => {
            if (
              !current ||
              current.id !==
                conversation.id
            ) {
              return current;
            }

            return {
              ...current,

              status:
                conversation.status,

              updatedAt:
                conversation.updatedAt,

              closedAt:
                conversation.closedAt,
            };
          },
        );
      },
      [],
    );

  const removeConversation =
    useCallback(
      (
        conversationId:
          string,
      ) => {
        const nextConversations =
          conversationsRef.current.filter(
            (
              conversation,
            ) =>
              conversation.id !==
              conversationId,
          );

        conversationsRef.current =
          nextConversations;

        setConversations(
          nextConversations,
        );

        if (
          selectedConversationIdRef
            .current ===
          conversationId
        ) {
          selectedConversationIdRef.current =
            null;

          setSelectedConversationId(
            null,
          );

          setActiveConversation(
            null,
          );
        }
      },
      [],
    );

  const addMessage =
    useCallback(
      (
        message:
          ChatMessage,
      ) => {
        setActiveConversation(
          (
            current,
          ) => {
            if (
              !current ||
              current.id !==
                message.conversationId
            ) {
              return current;
            }

            const alreadyExists =
              current.messages.some(
                (
                  currentMessage,
                ) =>
                  currentMessage.id ===
                  message.id,
              );

            if (
              alreadyExists
            ) {
              return current;
            }

            return {
              ...current,

              messages:
                sortMessages([
                  ...current.messages,
                  message,
                ]),
            };
          },
        );
      },
      [],
    );

  const loadConversation =
    useCallback(
      async (
        conversationId:
          string,
      ) => {
        if (
          !workspaceId
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

        try {
          setLoadingConversation(
            true,
          );

          setError(
            null,
          );

          selectedConversationIdRef.current =
            conversationId;

          setSelectedConversationId(
            conversationId,
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

          const socket =
            socketRef.current;

          if (
            socket
          ) {
            joinAgentConversation(
              socket,
              workspaceId,
              conversationId,
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
              : 'No se pudo cargar la conversación',
          );
        } finally {
          setLoadingConversation(
            false,
          );
        }
      },
      [
        onLogout,
        workspaceId,
      ],
    );

  async function handleClaimConversation() {
    if (
      !activeConversation ||
      activeConversation
        .assignedAgentId ||
      claimingConversationId
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

    const conversationId =
      activeConversation.id;

    claimingConversationIdRef.current =
      conversationId;

    setClaimingConversationId(
      conversationId,
    );

    if (
      claimProtectionTimeoutRef
        .current !==
      null
    ) {
      window.clearTimeout(
        claimProtectionTimeoutRef
          .current,
      );
    }

    claimProtectionTimeoutRef.current =
      window.setTimeout(
        () => {
          clearClaimProtection(
            conversationId,
          );
        },
        5000,
      );

    try {
      setError(
        null,
      );

      const claimedConversation =
        await claimConversation(
          accessToken,
          workspaceId,
          conversationId,
        );

      upsertConversation(
        claimedConversation,
      );

      setActiveConversation(
        (
          current,
        ) => {
          if (
            !current ||
            current.id !==
              conversationId
          ) {
            return current;
          }

          return {
            ...current,

            status:
              claimedConversation
                .status,

            assignedAgentId:
              claimedConversation
                .assignedAgentId,

            assignedAgent:
              claimedConversation
                .assignedAgent,

            updatedAt:
              claimedConversation
                .updatedAt,

            closedAt:
              claimedConversation
                .closedAt,
          };
        },
      );

      showNotification({
        type:
          'success',

        title:
          'Conversación tomada',

        message:
          'La conversación ahora está asignada a ti.',
      });
    } catch (
      err
    ) {
      console.error(
        err,
      );

      clearClaimProtection(
        conversationId,
      );

      const claimErrorMessage =
        err instanceof
          Error
          ? err.message
          : 'No se pudo tomar la conversación';

      const takenByAnotherAgent =
        claimErrorMessage
          .toLowerCase()
          .includes(
            'tomada por otro agente',
          );

      if (
        takenByAnotherAgent
      ) {
        showNotification({
          type:
            'warning',

          title:
            'No se pudo tomar la conversación',

          message:
            'Otro agente la tomó antes que tú.',
        });
      } else {
        setError(
          claimErrorMessage,
        );
      }

      try {
        const latestConversations =
          await getConversations(
            accessToken,
            workspaceId,
          );

        const sortedConversations =
          sortConversations(
            latestConversations,
          );

        const conversationStillVisible =
          sortedConversations.some(
            (
              conversation,
            ) =>
              conversation.id ===
              conversationId,
          );

        conversationsRef.current =
          sortedConversations;

        setConversations(
          sortedConversations,
        );

        if (
          !conversationStillVisible
        ) {
          removeConversation(
            conversationId,
          );
        }
      } catch (
        syncError
      ) {
        console.error(
          'No se pudo resincronizar la bandeja:',
          syncError,
        );
      }
    }
  }

  async function handleConversationStatus(
    status:
      | 'OPEN'
      | 'PENDING',
  ) {
    if (
      !activeConversation ||
      !activeConversation
        .assignedAgentId ||
      activeConversation.status ===
        'CLOSED' ||
      conversationAction
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

    const conversationId =
      activeConversation.id;

    try {
      setConversationAction(
        status,
      );

      setError(
        null,
      );

      const updatedConversation =
        await updateConversationStatus(
          accessToken,
          workspaceId,
          conversationId,
          status,
        );

      applyConversationStateUpdate(
        updatedConversation,
      );

      showNotification({
        type:
          'success',

        title:
          status ===
          'OPEN'
            ? 'Conversación abierta'
            : 'Conversación pendiente',

        message:
          status ===
          'OPEN'
            ? 'La conversación volvió a estado abierta.'
            : 'La conversación quedó en estado pendiente.',
      });
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
          : 'No se pudo cambiar el estado de la conversación',
      );
    } finally {
      setConversationAction(
        null,
      );
    }
  }

  async function handleCloseConversation() {
    if (
      !activeConversation ||
      !activeConversation
        .assignedAgentId ||
      activeConversation.status ===
        'CLOSED' ||
      conversationAction
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

    const conversationId =
      activeConversation.id;

    try {
      setConversationAction(
        'CLOSED',
      );

      setError(
        null,
      );

      const updatedConversation =
        await closeConversation(
          accessToken,
          workspaceId,
          conversationId,
        );

      applyConversationStateUpdate(
        updatedConversation,
      );

      resetComposer();

      showNotification({
        type:
          'success',

        title:
          'Conversación cerrada',

        message:
          'La conversación fue cerrada correctamente.',
      });
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
          : 'No se pudo cerrar la conversación',
      );
    } finally {
      setConversationAction(
        null,
      );
    }
  }

  function handleImageChange(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0] ??
      null;

    if (
      !file
    ) {
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (
      !allowedTypes.includes(
        file.type,
      )
    ) {
      event.target.value =
        '';

      showNotification({
        type:
          'warning',

        title:
          'Imagen no válida',

        message:
          'Solo se permiten imágenes JPEG, PNG, WEBP o GIF.',
      });

      return;
    }

    const maxSizeBytes =
      5 *
      1024 *
      1024;

    if (
      file.size >
      maxSizeBytes
    ) {
      event.target.value =
        '';

      showNotification({
        type:
          'warning',

        title:
          'Imagen demasiado grande',

        message:
          'La imagen no puede superar los 5 MB.',
      });

      return;
    }

    const previewUrl =
      URL.createObjectURL(
        file,
      );

    if (
      imagePreviewUrlRef
        .current
    ) {
      URL.revokeObjectURL(
        imagePreviewUrlRef
          .current,
      );
    }

    imagePreviewUrlRef.current =
      previewUrl;

    setSelectedImage(
      file,
    );

    setImagePreviewUrl(
      previewUrl,
    );
  }

  function clearSelectedImage() {
    if (
      imagePreviewUrlRef
        .current
    ) {
      URL.revokeObjectURL(
        imagePreviewUrlRef
          .current,
      );

      imagePreviewUrlRef.current =
        null;
    }

    setSelectedImage(
      null,
    );

    setImagePreviewUrl(
      null,
    );

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        '';
    }
  }

  async function sendCurrentMessage() {
    if (
      !activeConversation ||
      !activeConversation
        .assignedAgentId ||
      activeConversation.status ===
        'CLOSED' ||
      sendingMessage
    ) {
      return;
    }

    const content =
      composerText.trim();

    if (
      !content &&
      !selectedImage
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

    const conversationId =
      activeConversation.id;

    try {
      setSendingMessage(
        true,
      );

      setError(
        null,
      );

      const sentMessage =
        selectedImage
          ? await sendAgentImageMessage(
              accessToken,
              workspaceId,
              conversationId,
              selectedImage,
              content ||
                undefined,
            )
          : await sendAgentTextMessage(
              accessToken,
              workspaceId,
              conversationId,
              content,
            );

      addMessage(
        sentMessage,
      );

      resetComposer();
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
          : 'No se pudo enviar el mensaje',
      );
    } finally {
      setSendingMessage(
        false,
      );
    }
  }

  function handleComposerSubmit(
    event:
      SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void sendCurrentMessage();
  }

  function handleComposerKeyDown(
    event:
      KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key !==
        'Enter' ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();

    void sendCurrentMessage();
  }

  useEffect(
    () => {
      if (
        user.role !==
          'AGENT' ||
        !workspaceId
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

              setSocketStatus(
                'En línea',
              );

              const conversationId =
                selectedConversationIdRef
                  .current;

              const currentSocket =
                socketRef.current;

              if (
                conversationId &&
                currentSocket
              ) {
                joinAgentConversation(
                  currentSocket,
                  workspaceId,
                  conversationId,
                );
              }
            },

            onConversationJoined() {
              if (
                cancelled
              ) {
                return;
              }

              setSocketStatus(
                'En línea',
              );
            },

            onMessage(
              message,
            ) {
              if (
                cancelled
              ) {
                return;
              }

              addMessage(
                message,
              );
            },

            onConversationUpdated(
              conversation,
            ) {
              if (
                cancelled
              ) {
                return;
              }

              const previousConversation =
                conversationsRef.current.find(
                  (
                    currentConversation,
                  ) =>
                    currentConversation.id ===
                    conversation.id,
                );

              const wasAlreadyAssignedToMe =
                previousConversation
                  ?.assignedAgentId ===
                user.userId;

              const isNowAssignedToMe =
                conversation
                  .assignedAgentId ===
                user.userId;

              const isMyOwnClaim =
                claimingConversationIdRef
                  .current ===
                conversation.id;

              if (
                isNowAssignedToMe &&
                !wasAlreadyAssignedToMe &&
                !isMyOwnClaim
              ) {
                protectAssignedConversation(
                  conversation.id,
                );

                showNotification({
                  type:
                    'success',

                  title:
                    'Nueva conversación asignada',

                  message:
                    `Te asignaron la conversación del visitante ${conversation.visitor.id.slice(
                      0,
                      8,
                    )}.`,
                });
              }

              upsertConversation(
                conversation,
              );
            },

            onConversationRemoved(
              conversationId,
            ) {
              if (
                cancelled
              ) {
                return;
              }

              if (
                claimingConversationIdRef
                  .current ===
                conversationId
              ) {
                clearClaimProtection(
                  conversationId,
                );

                return;
              }

              if (
                assignedConversationProtectionRef
                  .current ===
                conversationId
              ) {
                clearAssignedConversationProtection(
                  conversationId,
                );

                return;
              }

              const removedConversation =
                conversationsRef.current.find(
                  (
                    conversation,
                  ) =>
                    conversation.id ===
                    conversationId,
                );

              if (
                removedConversation
                  ?.assignedAgentId ===
                null
              ) {
                showNotification({
                  type:
                    'warning',

                  title:
                    'Conversación tomada',

                  message:
                    'Otro agente tomó esta conversación.',
                });
              }

              removeConversation(
                conversationId,
              );
            },

            onDisconnect() {
              if (
                cancelled
              ) {
                return;
              }

              setSocketStatus(
                'Desconectado',
              );
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

      socketRef.current =
        socket;

      async function loadInbox() {
        try {
          setLoadingConversations(
            true,
          );

          setError(
            null,
          );

          const result =
            await getConversations(
              accessToken,
              workspaceId,
            );

          if (
            cancelled
          ) {
            return;
          }

          const sortedConversations =
            sortConversations(
              result,
            );

          conversationsRef.current =
            sortedConversations;

          setConversations(
            sortedConversations,
          );
        } catch (
          err
        ) {
          console.error(
            err,
          );

          if (
            !cancelled
          ) {
            setError(
              err instanceof
                Error
                ? err.message
                : 'No se pudieron cargar las conversaciones',
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoadingConversations(
              false,
            );
          }
        }
      }

      void loadInbox();

      return () => {
        cancelled =
          true;

        socket.disconnect();

        socketRef.current =
          null;
      };
    },
    [
      addMessage,
      clearAssignedConversationProtection,
      clearClaimProtection,
      onLogout,
      protectAssignedConversation,
      removeConversation,
      showNotification,
      upsertConversation,
      user.role,
      user.userId,
      workspaceId,
    ],
  );

  useEffect(
    () => {
      return () => {
        if (
          claimProtectionTimeoutRef
            .current !==
          null
        ) {
          window.clearTimeout(
            claimProtectionTimeoutRef
              .current,
          );
        }

        if (
          assignedConversationProtectionTimeoutRef
            .current !==
          null
        ) {
          window.clearTimeout(
            assignedConversationProtectionTimeoutRef
              .current,
          );
        }

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

        if (
          imagePreviewUrlRef
            .current
        ) {
          URL.revokeObjectURL(
            imagePreviewUrlRef
              .current,
          );

          imagePreviewUrlRef.current =
            null;
        }
      };
    },
    [],
  );

  useEffect(
    () => {
      const container =
        messagesContainerRef
          .current;

      if (
        !container
      ) {
        return;
      }

      container.scrollTop =
        container.scrollHeight;
    },
    [
      activeConversation
        ?.messages,
    ],
  );

  if (
    user.role !==
    'AGENT'
  ) {
    return (
      <main className="nova-loading">
        Esta bandeja está disponible
        para AGENT.
      </main>
    );
  }

  if (
    !workspaceId
  ) {
    return (
      <main className="nova-loading">
        El usuario no tiene un
        Workspace asociado.
      </main>
    );
  }

  const unassignedConversations =
    conversations.filter(
      (
        conversation,
      ) =>
        conversation
          .assignedAgentId ===
        null,
    );

  const myConversations =
    conversations.filter(
      (
        conversation,
      ) =>
        conversation
          .assignedAgentId !==
        null,
    );

  function renderConversation(
    conversation:
      ConversationSummary,
  ) {
    const selected =
      selectedConversationId ===
      conversation.id;

    return (
      <button
        type="button"
        key={
          conversation.id
        }
        className={
          selected
            ? 'nova-inbox__conversation nova-inbox__conversation--selected'
            : 'nova-inbox__conversation'
        }
        onClick={() => {
          resetComposer();

          void loadConversation(
            conversation.id,
          );
        }}
      >
        <div className="nova-inbox__conversation-top">
          <strong>
            Visitante{' '}
            {conversation
              .visitor
              .id
              .slice(
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

        <div className="nova-inbox__conversation-preview">
          {getLastMessage(
            conversation,
          )}
        </div>

        <div className="nova-inbox__conversation-bottom">
          <AppStatus
            status={
              conversation.status
            }
          />
        </div>
      </button>
    );
  }

  return (
    <main className="nova-inbox">
      <header className="nova-inbox__header">
        <div className="nova-inbox__brand">
          <div className="nova-dashboard__logo">
            N
          </div>

          <div className="nova-inbox__brand-text">
            <strong>
              Nova
            </strong>

            <span>
              Bandeja de atención
            </span>
          </div>
        </div>

        <div className="nova-inbox__header-right">
          <span
            className={
              socketStatus ===
              'En línea'
                ? 'nova-inbox__socket nova-inbox__socket--online'
                : 'nova-inbox__socket'
            }
          >
            {socketStatus}
          </span>

          <div className="nova-inbox__agent">
            <strong>
              {user.username}
            </strong>

            <span>
              AGENT
            </span>
          </div>

          <button
            type="button"
            className="nova-inbox__logout-button"
            onClick={
              onLogout
            }
          >
            Salir
          </button>
        </div>
      </header>

      <div className="nova-inbox__layout">
        <aside className="nova-inbox__sidebar">
          <div className="nova-inbox__sidebar-header">
            <h1>
              Conversaciones
            </h1>

            <p>
              {
                conversations.length
              }{' '}
              en tu bandeja
            </p>
          </div>

          {loadingConversations ? (
            <div className="nova-inbox__empty">
              Cargando conversaciones...
            </div>
          ) : conversations.length ===
            0 ? (
            <div className="nova-inbox__empty">
              <strong>
                Sin conversaciones
              </strong>

              <span>
                No hay conversaciones
                disponibles actualmente.
              </span>
            </div>
          ) : (
            <>
              <section className="nova-inbox__conversation-group">
                <div className="nova-inbox__conversation-group-header">
                  <strong>
                    Sin asignar
                  </strong>

                  <span>
                    {
                      unassignedConversations
                        .length
                    }
                  </span>
                </div>

                {unassignedConversations
                  .length ===
                0 ? (
                  <div className="nova-inbox__empty">
                    No hay conversaciones
                    sin asignar.
                  </div>
                ) : (
                  <div className="nova-inbox__conversation-list">
                    {unassignedConversations.map(
                      (
                        conversation,
                      ) =>
                        renderConversation(
                          conversation,
                        ),
                    )}
                  </div>
                )}
              </section>

              <section className="nova-inbox__conversation-group">
                <div className="nova-inbox__conversation-group-header">
                  <strong>
                    Mis conversaciones
                  </strong>

                  <span>
                    {
                      myConversations
                        .length
                    }
                  </span>
                </div>

                {myConversations
                  .length ===
                0 ? (
                  <div className="nova-inbox__empty">
                    Aún no tienes
                    conversaciones asignadas.
                  </div>
                ) : (
                  <div className="nova-inbox__conversation-list">
                    {myConversations.map(
                      (
                        conversation,
                      ) =>
                        renderConversation(
                          conversation,
                        ),
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </aside>

        <section className="nova-inbox__chat">
          {!selectedConversationId ? (
            <div className="nova-inbox__placeholder">
              <div className="nova-inbox__placeholder-icon">
                💬
              </div>

              <h2>
                Selecciona una conversación
              </h2>

              <p>
                Elige una conversación
                de la bandeja para ver
                los mensajes y comenzar
                a atender al visitante.
              </p>
            </div>
          ) : loadingConversation ? (
            <div className="nova-inbox__placeholder">
              Cargando conversación...
            </div>
          ) : activeConversation ? (
            <>
              <header className="nova-inbox__chat-header">
                <div className="nova-inbox__chat-person">
                  <div className="nova-inbox__chat-avatar">
                    {activeConversation
                      .visitor
                      .id
                      .slice(
                        0,
                        2,
                      )
                      .toUpperCase()}
                  </div>

                  <div className="nova-inbox__chat-person-text">
                    <h2>
                      Visitante{' '}
                      {activeConversation
                        .visitor
                        .id
                        .slice(
                          0,
                          8,
                        )}
                    </h2>

                    <span>
                      Última actividad:{' '}
                      {formatDateTime(
                        activeConversation
                          .visitor
                          .lastSeenAt,
                      )}
                    </span>
                  </div>
                </div>

                <div className="nova-inbox__chat-header-actions">
                  <AppStatus
                    status={
                      activeConversation.status
                    }
                  />

                  {activeConversation
                    .assignedAgentId ===
                  null ? (
                    <button
                      type="button"
                      className="nova-inbox__claim-button"
                      disabled={
                        claimingConversationId ===
                        activeConversation.id
                      }
                      onClick={() => {
                        void handleClaimConversation();
                      }}
                    >
                      {claimingConversationId ===
                      activeConversation.id
                        ? 'Tomando...'
                        : 'Tomar'}
                    </button>
                  ) : activeConversation.status !==
                    'CLOSED' ? (
                    <>
                      {activeConversation.status ===
                      'OPEN' ? (
                        <button
                          type="button"
                          disabled={
                            conversationAction !==
                            null
                          }
                          onClick={() => {
                            void handleConversationStatus(
                              'PENDING',
                            );
                          }}
                        >
                          {conversationAction ===
                          'PENDING'
                            ? 'Cambiando...'
                            : 'Pendiente'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            conversationAction !==
                            null
                          }
                          onClick={() => {
                            void handleConversationStatus(
                              'OPEN',
                            );
                          }}
                        >
                          {conversationAction ===
                          'OPEN'
                            ? 'Cambiando...'
                            : 'Abrir'}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={
                          conversationAction !==
                          null
                        }
                        onClick={() => {
                          void handleCloseConversation();
                        }}
                      >
                        {conversationAction ===
                        'CLOSED'
                          ? 'Cerrando...'
                          : 'Cerrar'}
                      </button>
                    </>
                  ) : null}
                </div>
              </header>

              <div
                className="nova-inbox__messages"
                ref={
                  messagesContainerRef
                }
              >
                {activeConversation
                  .messages
                  .length ===
                0 ? (
                  <div className="nova-inbox__empty">
                    Esta conversación todavía
                    no tiene mensajes.
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
                            ? 'nova-inbox-message nova-inbox-message--agent'
                            : 'nova-inbox-message nova-inbox-message--visitor'
                        }
                      >
                        {message.type ===
                        'IMAGE' ? (
                          <>
                            {message.mediaUrl ? (
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
                          </>
                        ) : message.type ===
                          'AUDIO' ? (
                          <>
                            {message.mediaUrl ? (
                              <audio
                                className="nova-inbox-message__audio"
                                controls
                                preload="metadata"
                                src={`${NOVA_API_URL}${message.mediaUrl}`}
                              >
                                Tu navegador no permite reproducir audio.
                              </audio>
                            ) : null}

                            {message.content ? (
                              <div>
                                {
                                  message.content
                                }
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div>
                            {
                              message.content
                            }
                          </div>
                        )}

                        <span>
                          {formatTime(
                            message.createdAt,
                          )}
                        </span>
                      </div>
                    ),
                  )
                )}
              </div>

              {activeConversation
                .assignedAgentId ===
              null ? (
                <footer className="nova-inbox__composer-placeholder">
                  Toma esta conversación
                  para poder responder.
                </footer>
              ) : activeConversation.status ===
                'CLOSED' ? (
                <footer className="nova-inbox__closed-state">
                  <div className="nova-inbox__closed-state-icon">
                    ✓
                  </div>

                  <div>
                    <strong>
                      Conversación cerrada
                    </strong>

                    <span>
                      Esta conversación ya no
                      admite respuestas.
                    </span>
                  </div>
                </footer>
              ) : (
                <footer className="nova-inbox__composer">
                  {selectedImage ? (
                    <div className="nova-inbox__image-preview">
                      {imagePreviewUrl ? (
                        <img
                          src={
                            imagePreviewUrl
                          }
                          alt="Vista previa de la imagen"
                        />
                      ) : null}

                      <div className="nova-inbox__image-preview-info">
                        <strong>
                          {
                            selectedImage.name
                          }
                        </strong>

                        <span>
                          {(
                            selectedImage.size /
                            1024 /
                            1024
                          ).toFixed(
                            2,
                          )}{' '}
                          MB
                        </span>
                      </div>

                      <button
                        type="button"
                        className="nova-inbox__image-remove"
                        aria-label="Quitar imagen"
                        disabled={
                          sendingMessage
                        }
                        onClick={
                          clearSelectedImage
                        }
                      >
                        ×
                      </button>
                    </div>
                  ) : null}

                  <form
                    className="nova-inbox__composer-form"
                    onSubmit={
                      handleComposerSubmit
                    }
                  >
                    <input
                      ref={
                        fileInputRef
                      }
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      hidden
                      onChange={
                        handleImageChange
                      }
                    />

                    <button
                      type="button"
                      className="nova-inbox__attachment-button"
                      aria-label="Adjuntar imagen"
                      title="Adjuntar imagen"
                      disabled={
                        sendingMessage
                      }
                      onClick={() => {
                        fileInputRef
                          .current
                          ?.click();
                      }}
                    >
                      📎
                    </button>

                    <textarea
                      className="nova-inbox__composer-textarea"
                      value={
                        composerText
                      }
                      placeholder="Escribe un mensaje..."
                      aria-label="Mensaje"
                      rows={1}
                      disabled={
                        sendingMessage
                      }
                      onChange={(
                        event,
                      ) => {
                        setComposerText(
                          event.target.value,
                        );
                      }}
                      onKeyDown={
                        handleComposerKeyDown
                      }
                    />

                    <button
                      type="submit"
                      className="nova-inbox__send-button"
                      disabled={
                        sendingMessage ||
                        (
                          !composerText.trim() &&
                          !selectedImage
                        )
                      }
                    >
                      {sendingMessage
                        ? 'Enviando...'
                        : 'Enviar'}
                    </button>
                  </form>

                  <div className="nova-inbox__composer-hint">
                    Enter para enviar ·
                    Shift + Enter para salto
                    de línea
                  </div>
                </footer>
              )}
            </>
          ) : null}
        </section>
      </div>

      {notification ? (
        <div
          className={
            notification.type ===
            'success'
              ? 'nova-inbox__notification nova-inbox__notification--success'
              : 'nova-inbox__notification nova-inbox__notification--warning'
          }
          role={
            notification.type ===
            'warning'
              ? 'alert'
              : 'status'
          }
          aria-live="polite"
        >
          <div>
            <strong>
              {notification.type ===
              'success'
                ? '✓ '
                : '⚠ '}
              {
                notification.title
              }
            </strong>

            <span>
              {
                notification.message
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

      {error ? (
        <div
          className="nova-inbox__error"
          role="alert"
        >
          <span>
            {error}
          </span>

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
    </main>
  );
}