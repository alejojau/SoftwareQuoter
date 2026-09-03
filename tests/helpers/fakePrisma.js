/**
 * Prisma falso en memoria, con exactamente las operaciones que
 * confirmCheckpoint (src/services/documentNodes.service.js) usa dentro de
 * su transacción. Permite probar la lógica de checkpoint + invalidación de
 * punta a punta sin necesitar un PostgreSQL real — útil ahora; no
 * reemplaza pruebas de integración contra una base real, que quedan
 * pendientes para cuando haya una disponible (ver README de tests).
 */
function createFakePrisma(initialNodes = []) {
  const state = {
    documentNodes: new Map(initialNodes.map((n) => [n.id, { ...n }])),
    documentVersions: new Map(),
    changeEvents: new Map(),
    invalidationRuns: new Map(),
  };

  let idSeq = 0;
  const nextId = (prefix) => `${prefix}_${++idSeq}`;

  const documentNode = {
    findUnique: async ({ where }) => {
      const node = state.documentNodes.get(where.id);
      return node ? { ...node } : null;
    },
    findMany: async ({ where }) => {
      return [...state.documentNodes.values()].filter((n) => n.projectId === where.projectId);
    },
    update: async ({ where, data }) => {
      const node = state.documentNodes.get(where.id);
      Object.assign(node, data);
      return { ...node };
    },
    updateMany: async ({ where, data }) => {
      const ids = where.id.in;
      let count = 0;
      for (const id of ids) {
        const node = state.documentNodes.get(id);
        if (node) {
          Object.assign(node, data);
          count += 1;
        }
      }
      return { count };
    },
  };

  const documentVersion = {
    count: async ({ where }) =>
      [...state.documentVersions.values()].filter((v) => v.documentNodeId === where.documentNodeId)
        .length,
    create: async ({ data }) => {
      const version = { id: nextId('ver'), ...data };
      state.documentVersions.set(version.id, version);
      return version;
    },
  };

  const changeEvent = {
    create: async ({ data }) => {
      const event = { id: nextId('evt'), ...data };
      state.changeEvents.set(event.id, event);
      return event;
    },
  };

  const invalidationRun = {
    create: async ({ data }) => {
      const run = { id: nextId('run'), ...data };
      state.invalidationRuns.set(run.id, run);
      return run;
    },
  };

  const client = { documentNode, documentVersion, changeEvent, invalidationRun };
  client.$transaction = async (fn) => fn(client);

  return { client, state };
}

module.exports = { createFakePrisma };
