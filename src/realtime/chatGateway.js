const { Server } = require('socket.io');
const { createMessage } = require('../services/messages.service');

/**
 * Transporte en vivo del chat (§6, ADR-0003). Un proceso servidor = una
 * sala de Socket.IO por proyecto; la presencia se guarda en memoria, así
 * que escalar a varios procesos requeriría un adapter compartido (ej.
 * Redis) — fuera de alcance de esta pasada.
 */
function createChatGateway(httpServer, { prisma }) {
  const io = new Server(httpServer, { cors: { origin: '*' } });

  // projectId -> Map<socketId, userId>
  const presenceByProject = new Map();

  const roomFor = (projectId) => `project:${projectId}`;

  function broadcastPresence(projectId) {
    const sockets = presenceByProject.get(projectId);
    const userIds = sockets ? [...new Set(sockets.values())] : [];
    io.to(roomFor(projectId)).emit('presence_update', { projectId, userIds });
  }

  // Autenticación: mismo stub que la API REST (ver src/middleware/currentUser.js)
  // — identifica al usuario por auth.userId hasta que exista un mecanismo real.
  io.use(async (socket, next) => {
    try {
      const userId = socket.handshake.auth?.userId;
      if (!userId) return next(new Error('unauthorized'));
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = user;
      next();
    } catch (err) {
      next(err);
    }
  });

  // Saca al socket de la sala/presencia del proyecto que tuviera abierto
  // antes — sin esto, un cliente que navega de un proyecto a otro sin
  // desconectarse queda "fantasma" en la presencia del anterior.
  function leaveCurrentProject(socket) {
    const previousProjectId = socket.data.projectId;
    if (!previousProjectId) return;

    socket.leave(roomFor(previousProjectId));
    const sockets = presenceByProject.get(previousProjectId);
    if (sockets) {
      sockets.delete(socket.id);
      broadcastPresence(previousProjectId);
    }
    socket.data.projectId = null;
  }

  io.on('connection', (socket) => {
    // RF-02: unirse a la sala de un proyecto requiere ser miembro de ese
    // proyecto — sin esto, cualquier usuario autenticado podría escuchar
    // y escribir en el chat de cualquier proyecto ajeno.
    socket.on('join_project', async ({ projectId } = {}, ack) => {
      try {
        if (!projectId) throw new Error('projectId es requerido');

        const membership = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: socket.data.user.id } },
        });
        if (!membership) throw new Error('No perteneces a este proyecto');

        if (socket.data.projectId && socket.data.projectId !== projectId) {
          leaveCurrentProject(socket);
        }

        socket.join(roomFor(projectId));
        socket.data.projectId = projectId;

        if (!presenceByProject.has(projectId)) presenceByProject.set(projectId, new Map());
        presenceByProject.get(projectId).set(socket.id, socket.data.user.id);
        broadcastPresence(projectId);

        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    // RF-03/§6: enviar un mensaje de chat directamente por WebSocket, sin
    // pasar por el endpoint REST — misma lógica compartida (messages.service).
    socket.on('send_message', async ({ projectId, content, documentNodeId } = {}, ack) => {
      try {
        if (!projectId || !content) throw new Error('projectId y content son requeridos');
        if (socket.data.projectId !== projectId) {
          throw new Error('Únete al proyecto (join_project) antes de enviar mensajes');
        }

        const message = await createMessage({
          prisma,
          projectId,
          actor: { type: 'USUARIO', userId: socket.data.user.id },
          content,
          documentNodeId,
        });

        io.to(roomFor(projectId)).emit('message_created', message);
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('typing', ({ projectId, isTyping } = {}) => {
      if (!projectId || socket.data.projectId !== projectId) return;
      socket.to(roomFor(projectId)).emit('presence_typing', {
        userId: socket.data.user.id,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on('disconnect', () => {
      leaveCurrentProject(socket);
    });
  });

  return {
    io,
    emitMessage(projectId, message) {
      io.to(roomFor(projectId)).emit('message_created', message);
    },
    /** §6: eventos de sistema embebidos en el chat (nueva versión, invalidación, etc.). */
    emitDocumentEvent(projectId, event) {
      io.to(roomFor(projectId)).emit('document_event', event);
    },
  };
}

module.exports = { createChatGateway };
