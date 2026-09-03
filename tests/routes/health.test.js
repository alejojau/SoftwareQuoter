const request = require('supertest');
const { createApp } = require('../../src/app');

describe('GET /api/health', () => {
  test('responde sin necesitar base de datos ni autenticación', async () => {
    // /api/health se registra antes del router autenticado, así que no
    // necesita X-User-Id ni un cliente Prisma real.
    const app = createApp({ prisma: {} });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Server is running');
  });
});

describe('autenticación (stub por X-User-Id)', () => {
  test('rechaza una ruta de la API sin el header X-User-Id', async () => {
    const app = createApp({ prisma: {} });
    const res = await request(app).get('/api/workspaces/whatever');
    expect(res.status).toBe(401);
  });
});
