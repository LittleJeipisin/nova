export type ConversationStatus =
  | 'OPEN'
  | 'PENDING'
  | 'CLOSED';

export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'AUDIO';

export type MessageSenderType =
  | 'VISITOR'
  | 'USER';

export type ConversationVisitor = {
  id:
    string;

  workspaceId:
    string;

  createdAt:
    string;

  updatedAt:
    string;

  lastSeenAt:
    string;
};

export type ConversationAgent = {
  id:
    string;

  username:
    string;

  role:
    string;

  status:
    string;
};

export type ChatMessage = {
  id:
    string;

  conversationId:
    string;

  senderType:
    MessageSenderType;

  senderUserId:
    string | null;

  senderVisitorId:
    string | null;

  type:
    MessageType;

  content:
    string | null;

  mediaUrl:
    string | null;

  createdAt:
    string;

  senderUser?: {
    id:
      string;

    username:
      string;

    role:
      string;
  } | null;
};

export type ConversationSummary = {
  id:
    string;

  status:
    ConversationStatus;

  workspaceId:
    string;

  visitorId:
    string;

  assignedAgentId:
    string | null;

  createdAt:
    string;

  updatedAt:
    string;

  closedAt:
    string | null;

  visitor:
    ConversationVisitor;

  assignedAgent:
    ConversationAgent | null;

  messages:
    ChatMessage[];
};

export type ConversationDetail = {
  id:
    string;

  status:
    ConversationStatus;

  workspaceId:
    string;

  visitorId:
    string;

  assignedAgentId:
    string | null;

  createdAt:
    string;

  updatedAt:
    string;

  closedAt:
    string | null;

  visitor:
    ConversationVisitor;

  assignedAgent:
    ConversationAgent | null;

  messages:
    ChatMessage[];
};