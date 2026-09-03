const { NotFoundError } = require('../errors/AppError');

/**
 * Crea un mensaje de chat (§6). Compartido entre la ruta REST y el gateway
 * de WebSocket (ADR-0003) para no duplicar la lógica de "a qué ChatSession
 * pertenece este proyecto" en dos sitios.
 */
async function createMessage({ prisma, projectId, actor, content, documentNodeId = null, type = 'TEXTO' }) {
  const chatSession = await prisma.chatSession.findUnique({ where: { projectId } });
  if (!chatSession) throw new NotFoundError('Proyecto sin chat asociado');

  return prisma.message.create({
    data: {
      chatSessionId: chatSession.id,
      projectId,
      authorType: actor.type,
      authorUserId: actor.type === 'USUARIO' ? actor.userId : null,
      authorAgent: actor.type === 'AGENTE' ? actor.agent : null,
      type,
      content,
      documentNodeId,
    },
  });
}

module.exports = { createMessage };
