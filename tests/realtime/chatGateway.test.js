const http = require('http');
const { io: ioClient } = require('socket.io-client');
const { createChatGateway } = require('../../src/realtime/chatGateway');
const { createFakeChatPrisma } = require('../helpers/fakeChatPrisma');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function waitFor(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('chatGateway (§6, ADR-0003)', () => {
  let httpServer;
  let gateway;
  let port;

  function connect(userId) {
    return ioClient(`http://127.0.0.1:${port}`, {
      auth: { userId },
      transports: ['websocket'],
      reconnection: false,
    });
  }

  beforeEach(async () => {
    const fake = createFakeChatPrisma({
      users: [
        { id: 'u1', email: 'a@a.com', name: 'A' },
        { id: 'u2', email: 'b@b.com', name: 'B' },
      ],
      chatSessions: [{ projectId: 'p1', id: 'cs1' }],
      projectMembers: [
        { projectId: 'p1', userId: 'u1' },
        { projectId: 'p1', userId: 'u2' },
      ],
    });

    httpServer = http.createServer();
    gateway = createChatGateway(httpServer, { prisma: fake.client });
    port = await listen(httpServer);
  });

  afterEach(async () => {
    gateway.io.close();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  test('rechaza la conexión con un userId que no existe', async () => {
    const socket = connect('no-existe');
    const err = await waitFor(socket, 'connect_error');
    expect(err.message).toBe('unauthorized');
    socket.close();
  });

  test('rechaza join_project si el usuario no es miembro del proyecto', async () => {
    const socket = connect('u1');
    await waitFor(socket, 'connect');

    const ack = await new Promise((resolve) => {
      socket.emit('join_project', { projectId: 'proyecto-ajeno' }, resolve);
    });

    expect(ack.ok).toBe(false);
    socket.close();
  });

  test('dos miembros del mismo proyecto reciben los mensajes en vivo', async () => {
    const socketA = connect('u1');
    const socketB = connect('u2');

    await Promise.all([waitFor(socketA, 'connect'), waitFor(socketB, 'connect')]);

    const joinA = new Promise((resolve) => socketA.emit('join_project', { projectId: 'p1' }, resolve));
    const joinB = new Promise((resolve) => socketB.emit('join_project', { projectId: 'p1' }, resolve));
    const [ackA, ackB] = await Promise.all([joinA, joinB]);
    expect(ackA.ok).toBe(true);
    expect(ackB.ok).toBe(true);

    const received = waitFor(socketB, 'message_created');
    const sendAck = new Promise((resolve) => {
      socketA.emit('send_message', { projectId: 'p1', content: 'hola desde A' }, resolve);
    });

    const [message, ack] = await Promise.all([received, sendAck]);

    expect(ack.ok).toBe(true);
    expect(message.content).toBe('hola desde A');
    expect(message.authorUserId).toBe('u1');

    socketA.close();
    socketB.close();
  });

  test('no se puede enviar un mensaje a un proyecto al que no te has unido', async () => {
    const socket = connect('u1');
    await waitFor(socket, 'connect');

    const ack = await new Promise((resolve) => {
      socket.emit('send_message', { projectId: 'p1', content: 'hola' }, resolve);
    });

    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/join_project/);
    socket.close();
  });

  test('cambiar de proyecto sin desconectarse limpia la presencia del proyecto anterior', async () => {
    const fake = createFakeChatPrisma({
      users: [{ id: 'u1', email: 'a@a.com', name: 'A' }],
      chatSessions: [
        { projectId: 'p1', id: 'cs1' },
        { projectId: 'p2', id: 'cs2' },
      ],
      projectMembers: [
        { projectId: 'p1', userId: 'u1' },
        { projectId: 'p2', userId: 'u1' },
      ],
    });
    gateway.io.close();
    httpServer.close();
    httpServer = http.createServer();
    gateway = createChatGateway(httpServer, { prisma: fake.client });
    port = await listen(httpServer);

    const socket = connect('u1');
    await waitFor(socket, 'connect');

    await new Promise((resolve) => socket.emit('join_project', { projectId: 'p1' }, resolve));

    const nextPresenceUpdate = waitFor(socket, 'presence_update');
    await new Promise((resolve) => socket.emit('join_project', { projectId: 'p2' }, resolve));
    const p2Presence = await nextPresenceUpdate;

    // El socket ya no debe figurar en la presencia de p1.
    expect(p2Presence.projectId).toBe('p2');
    expect(p2Presence.userIds).toEqual(['u1']);

    // Enviar a p1 ahora debe fallar: el socket ya no está unido a esa sala.
    const ack = await new Promise((resolve) => {
      socket.emit('send_message', { projectId: 'p1', content: 'hola' }, resolve);
    });
    expect(ack.ok).toBe(false);

    socket.close();
  });

  test('presence_update refleja quién está conectado al proyecto', async () => {
    const socket = connect('u1');
    await waitFor(socket, 'connect');

    const presence = waitFor(socket, 'presence_update');
    socket.emit('join_project', { projectId: 'p1' });

    const payload = await presence;
    expect(payload.projectId).toBe('p1');
    expect(payload.userIds).toEqual(['u1']);

    socket.close();
  });
});
