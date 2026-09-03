const { PrismaClient } = require('@prisma/client');

let prisma;

/**
 * Cliente Prisma singleton — evita abrir un pool de conexiones nuevo por
 * cada require() (problema común de hot-reload en desarrollo).
 */
function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

module.exports = { getPrismaClient };
