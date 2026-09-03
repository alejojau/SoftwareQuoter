const { confirmCheckpoint } = require('../../src/services/documentNodes.service');
const { createFakePrisma } = require('../helpers/fakePrisma');

describe('confirmCheckpoint (RF-25, RF-26, RF-16, RF-17, §4)', () => {
  test('checkpointear BUSINESS_BRIEF invalida toda la cadena que ya existe y respeta quién aprobó cada una', async () => {
    const { client, state } = createFakePrisma([
      {
        id: 'brief',
        projectId: 'p1',
        type: 'BUSINESS_BRIEF',
        state: 'BORRADOR',
        pendingChanges: [{ summary: 'cambio de país' }],
        currentVersionId: null,
      },
      {
        id: 'legal',
        projectId: 'p1',
        type: 'LEGAL_FINDINGS',
        state: 'APROBADO',
        approvedByType: 'AGENTE',
        currentVersionId: 'v_legal',
      },
      {
        id: 'req',
        projectId: 'p1',
        type: 'REQUIREMENTS',
        state: 'APROBADO',
        approvedByType: 'USUARIO',
        currentVersionId: 'v_req',
      },
      {
        id: 'quote',
        projectId: 'p1',
        type: 'QUOTE',
        state: 'APROBADO',
        approvedByType: 'USUARIO',
        currentVersionId: 'v_quote',
      },
    ]);

    const result = await confirmCheckpoint({
      prisma: client,
      documentNodeId: 'brief',
      content: { pais: 'Colombia' },
      actor: { type: 'USUARIO', userId: 'u1' },
    });

    // El documento checkpointeado queda aprobado con su nueva versión.
    expect(result.documentNode.state).toBe('APROBADO');
    expect(result.documentNode.pendingChanges).toEqual([]);
    expect(result.version.number).toBe(1);

    // Todo lo aguas abajo que ya existía queda obsoleto (RF-16).
    expect(state.documentNodes.get('legal').state).toBe('REGENERANDO'); // aprobado solo por agente -> auto-regenera (RF-17)
    expect(state.documentNodes.get('req').state).toBe('OBSOLETO'); // aprobado por humano -> espera confirmación
    expect(state.documentNodes.get('quote').state).toBe('OBSOLETO');

    // Queda un único ChangeEvent + InvalidationRun por checkpoint, no uno
    // por cada documento invalidado.
    expect(state.changeEvents.size).toBe(1);
    expect(state.invalidationRuns.size).toBe(1);
    const [run] = state.invalidationRuns.values();
    expect(run.invalidatedNodeIds.sort()).toEqual(['legal', 'quote', 'req'].sort());
  });

  test('checkpointear un documento sin nada aguas abajo no crea ChangeEvent ni InvalidationRun', async () => {
    const { client, state } = createFakePrisma([
      { id: 'quote', projectId: 'p1', type: 'QUOTE', state: 'BORRADOR', pendingChanges: [{ summary: 'ajuste final' }], currentVersionId: null },
    ]);

    const result = await confirmCheckpoint({
      prisma: client,
      documentNodeId: 'quote',
      content: { total: 1000 },
      actor: { type: 'USUARIO', userId: 'u1' },
    });

    expect(result.changeEvent).toBeNull();
    expect(result.invalidationRun).toBeNull();
    expect(state.changeEvents.size).toBe(0);
  });

  test('rechaza el checkpoint si no hay cambios pendientes sobre un documento ya versionado', async () => {
    const { client } = createFakePrisma([
      { id: 'brief', projectId: 'p1', type: 'BUSINESS_BRIEF', state: 'APROBADO', pendingChanges: [], currentVersionId: 'v1' },
    ]);

    await expect(
      confirmCheckpoint({
        prisma: client,
        documentNodeId: 'brief',
        content: {},
        actor: { type: 'USUARIO', userId: 'u1' },
      })
    ).rejects.toThrow('No hay cambios pendientes');
  });

  test('un checkpoint hecho por un agente (regeneración) marca el ChangeEvent con el origen correcto', async () => {
    const { client, state } = createFakePrisma([
      {
        id: 'legal',
        projectId: 'p1',
        type: 'LEGAL_FINDINGS',
        state: 'OBSOLETO',
        pendingChanges: [{ summary: 'Regenerado tras invalidación por cambio en Brief' }],
        currentVersionId: 'v_old',
      },
      { id: 'req', projectId: 'p1', type: 'REQUIREMENTS', state: 'APROBADO', approvedByType: 'AGENTE', currentVersionId: 'v_req' },
    ]);

    await confirmCheckpoint({
      prisma: client,
      documentNodeId: 'legal',
      content: { hallazgos: [] },
      actor: { type: 'AGENTE', agent: 'LEGAL' },
    });

    const [event] = state.changeEvents.values();
    expect(event.origin).toBe('REGENERACION_AGENTE');
  });
});
