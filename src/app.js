const path = require('path');
const express = require('express');
const cors = require('cors');
const { getPrismaClient } = require('./lib/prisma');
const buildRouter = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const noopEmitters = {
  emitMessage: () => {},
  emitDocumentEvent: () => {},
};

/**
 * Fábrica de la app Express. Recibe el cliente Prisma y los emisores del
 * chat en vivo por parámetro (en vez de importarlos directo en cada
 * módulo) para poder inyectar dobles de prueba sin necesitar una base de
 * datos ni un servidor de WebSocket reales. `emitters` es opcional y por
 * defecto no hace nada — así la API REST funciona igual sin el gateway de
 * WebSocket (src/realtime/chatGateway.js) montado encima.
 */
function createApp({ prisma = getPrismaClient(), emitters = {} } = {}) {
  const app = express();
  const safeEmitters = { ...noopEmitters, ...emitters };

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
  });

  app.use('/api', buildRouter(prisma, safeEmitters));

  // Sirve el frontend (client/build) una vez exista — ver README.
  app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'), (err) => {
      if (err) next();
    });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
