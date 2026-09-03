const http = require('http');
const { createApp } = require('./app');
const { getPrismaClient } = require('./lib/prisma');
const { createChatGateway } = require('./realtime/chatGateway');

/**
 * Envuelve createApp con un http.Server real y le monta el gateway de
 * WebSocket (ADR-0003) encima, inyectando sus emisores en las rutas para
 * que la API REST y el chat en vivo compartan un único origen de eventos.
 * Separado de createApp para que la app Express siga siendo testeable con
 * supertest sin necesitar sockets reales (ver tests/routes/health.test.js).
 */
function createHttpServer({ prisma = getPrismaClient() } = {}) {
  const httpServer = http.createServer();
  const gateway = createChatGateway(httpServer, { prisma });

  const app = createApp({
    prisma,
    emitters: {
      emitMessage: gateway.emitMessage,
      emitDocumentEvent: gateway.emitDocumentEvent,
    },
  });

  httpServer.on('request', app);

  return { httpServer, io: gateway.io };
}

module.exports = { createHttpServer };
