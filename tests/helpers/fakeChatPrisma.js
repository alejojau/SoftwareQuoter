/**
 * Prisma falso en memoria para probar la capa de chat (mensajes, gateway
 * de WebSocket) sin una base de datos real — cubre justo las operaciones
 * que src/services/messages.service.js y src/realtime/chatGateway.js usan.
 */
function createFakeChatPrisma({ users = [], chatSessions = [], projectMembers = [] } = {}) {
  const state = {
    users: new Map(users.map((u) => [u.id, u])),
    chatSessions: new Map(chatSessions.map((c) => [c.projectId, c])),
    projectMembers: new Map(
      projectMembers.map((m) => [`${m.projectId}:${m.userId}`, m])
    ),
    messages: [],
  };

  let idSeq = 0;
  const nextId = (prefix) => `${prefix}_${++idSeq}`;

  const user = {
    findUnique: async ({ where }) => state.users.get(where.id) || null,
  };

  const chatSession = {
    findUnique: async ({ where }) => state.chatSessions.get(where.projectId) || null,
  };

  const projectMember = {
    findUnique: async ({ where }) => {
      const { projectId, userId } = where.projectId_userId;
      return state.projectMembers.get(`${projectId}:${userId}`) || null;
    },
  };

  const message = {
    create: async ({ data }) => {
      const msg = { id: nextId('msg'), createdAt: new Date().toISOString(), ...data };
      state.messages.push(msg);
      return msg;
    },
  };

  return { client: { user, chatSession, projectMember, message }, state };
}

module.exports = { createFakeChatPrisma };
