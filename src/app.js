const path = require('path');
const express = require('express');
const cors = require('cors');
const { getPrismaClient } = require('./lib/prisma');
const buildRouter = require('./routes');
const errorHandler = require('./middleware/errorHandler');

/**
 * Fábrica de la app Express. Recibe el cliente Prisma por parámetro (en
 * vez de importarlo directo en cada módulo) para poder inyectar un cliente
 * de prueba en los tests sin necesitar una base de datos real.
 */
function createApp({ prisma = getPrismaClient() } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
  });

  app.use('/api', buildRouter(prisma));

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
