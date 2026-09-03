const { addPendingChange, buildCheckpointVersion } = require('../../src/domain/checkpoint');

describe('addPendingChange (RF-25)', () => {
  test('acumula sobre una lista vacía o inexistente', () => {
    const result = addPendingChange({ pendingChanges: null }, {
      summary: 'ajuste 1',
      authorType: 'USUARIO',
      authorUserId: 'u1',
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ summary: 'ajuste 1', authorUserId: 'u1' });
  });

  test('acumula sobre una lista existente sin tocar las entradas previas', () => {
    const existing = [
      { summary: 'ajuste previo', authorType: 'USUARIO', authorUserId: 'u1', at: '2026-01-01T00:00:00.000Z' },
    ];
    const result = addPendingChange({ pendingChanges: existing }, {
      summary: 'ajuste 2',
      authorType: 'AGENTE',
      authorAgent: 'ANALISTA_REQUERIMIENTOS',
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(existing[0]);
    expect(result[1]).toMatchObject({ summary: 'ajuste 2', authorAgent: 'ANALISTA_REQUERIMIENTOS' });
  });

  test('no muta el array original (inmutable)', () => {
    const existing = [{ summary: 'x', authorType: 'USUARIO', authorUserId: 'u1', at: 'now' }];
    addPendingChange({ pendingChanges: existing }, { summary: 'y', authorType: 'USUARIO', authorUserId: 'u1' });
    expect(existing).toHaveLength(1);
  });
});

describe('buildCheckpointVersion (RF-26)', () => {
  test('construye la versión a partir de los cambios acumulados', () => {
    const node = { pendingChanges: [{ summary: 'x' }], currentVersionId: 'v1' };
    const version = buildCheckpointVersion(node, {
      content: { foo: 'bar' },
      actor: { type: 'USUARIO', userId: 'u1' },
    });
    expect(version.content).toEqual({ foo: 'bar' });
    expect(version.approvedByType).toBe('USUARIO');
    expect(version.approvedByUserId).toBe('u1');
    expect(version.changesSummary).toEqual([{ summary: 'x' }]);
  });

  test('permite la primera versión de un documento aunque no haya pendingChanges', () => {
    const node = { pendingChanges: [], currentVersionId: null };
    expect(() =>
      buildCheckpointVersion(node, { content: {}, actor: { type: 'AGENTE', agent: 'ELICITADOR' } })
    ).not.toThrow();
  });

  test('rechaza checkpointear un documento existente sin nada nuevo que consolidar', () => {
    const node = { pendingChanges: [], currentVersionId: 'v1' };
    expect(() =>
      buildCheckpointVersion(node, { content: {}, actor: { type: 'USUARIO', userId: 'u1' } })
    ).toThrow('No hay cambios pendientes');
  });
});
