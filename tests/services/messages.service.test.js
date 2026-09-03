const { createMessage } = require('../../src/services/messages.service');
const { createFakeChatPrisma } = require('../helpers/fakeChatPrisma');

describe('createMessage', () => {
  test('guarda el mensaje contra la ChatSession del proyecto', async () => {
    const { client, state } = createFakeChatPrisma({
      chatSessions: [{ projectId: 'p1', id: 'cs1' }],
    });

    const message = await createMessage({
      prisma: client,
      projectId: 'p1',
      actor: { type: 'USUARIO', userId: 'u1' },
      content: 'hola',
    });

    expect(message.chatSessionId).toBe('cs1');
    expect(message.authorType).toBe('USUARIO');
    expect(message.authorUserId).toBe('u1');
    expect(state.messages).toHaveLength(1);
  });

  test('un mensaje de agente no lleva authorUserId', async () => {
    const { client } = createFakeChatPrisma({ chatSessions: [{ projectId: 'p1', id: 'cs1' }] });

    const message = await createMessage({
      prisma: client,
      projectId: 'p1',
      actor: { type: 'AGENTE', agent: 'ELICITADOR' },
      content: '¿En qué país opera el negocio?',
    });

    expect(message.authorUserId).toBeNull();
    expect(message.authorAgent).toBe('ELICITADOR');
  });

  test('lanza NotFoundError si el proyecto no tiene chat asociado', async () => {
    const { client } = createFakeChatPrisma({ chatSessions: [] });

    await expect(
      createMessage({
        prisma: client,
        projectId: 'nope',
        actor: { type: 'USUARIO', userId: 'u1' },
        content: 'x',
      })
    ).rejects.toThrow('sin chat asociado');
  });
});
