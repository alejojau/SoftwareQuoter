const {
  shouldAutoRegenerate,
  computeInvalidationPlan,
} = require('../../src/domain/invalidation');

describe('shouldAutoRegenerate (RF-17)', () => {
  test('un nodo que aún no está aprobado siempre puede regenerarse', () => {
    expect(shouldAutoRegenerate({ state: 'BORRADOR' })).toBe(true);
  });

  test('un nodo aprobado solo por su agente puede regenerarse sin preguntar', () => {
    expect(shouldAutoRegenerate({ state: 'APROBADO', approvedByType: 'AGENTE' })).toBe(true);
  });

  test('un nodo aprobado por un humano NO se regenera automáticamente por defecto', () => {
    expect(shouldAutoRegenerate({ state: 'APROBADO', approvedByType: 'USUARIO' })).toBe(false);
  });

  test('un nodo aprobado por un humano sí se regenera si el proyecto activó auto-regenerar', () => {
    expect(
      shouldAutoRegenerate(
        { state: 'APROBADO', approvedByType: 'USUARIO' },
        { autoRegenerateDrafts: true }
      )
    ).toBe(true);
  });
});

describe('computeInvalidationPlan (RF-16, RF-17, §4)', () => {
  test('invalida toda la cadena aguas abajo que ya existe, respetando quién la aprobó', () => {
    const nodesByType = {
      LEGAL_FINDINGS: { id: 'l1', type: 'LEGAL_FINDINGS', state: 'APROBADO', approvedByType: 'AGENTE' },
      REQUIREMENTS: { id: 'r1', type: 'REQUIREMENTS', state: 'APROBADO', approvedByType: 'USUARIO' },
      QUOTE: { id: 'q1', type: 'QUOTE', state: 'APROBADO', approvedByType: 'USUARIO' },
    };

    const plan = computeInvalidationPlan('BUSINESS_BRIEF', nodesByType, {});

    expect(plan.toInvalidate.map((n) => n.id).sort()).toEqual(['l1', 'q1', 'r1'].sort());
    expect(plan.toAutoRegenerate.map((n) => n.id)).toEqual(['l1']);
    expect(plan.toNotifyOnly.map((n) => n.id).sort()).toEqual(['q1', 'r1'].sort());
  });

  test('los documentos que todavía no existen en el proyecto simplemente se omiten', () => {
    const plan = computeInvalidationPlan('BUSINESS_BRIEF', {}, {});
    expect(plan.toInvalidate).toEqual([]);
    expect(plan.toAutoRegenerate).toEqual([]);
    expect(plan.toNotifyOnly).toEqual([]);
  });

  test('con autoRegenerateDrafts activo, todo lo invalidado se auto-regenera', () => {
    const nodesByType = {
      QUOTE: { id: 'q1', type: 'QUOTE', state: 'APROBADO', approvedByType: 'USUARIO' },
    };
    const plan = computeInvalidationPlan('SCOPE', nodesByType, { autoRegenerateDrafts: true });
    expect(plan.toAutoRegenerate.map((n) => n.id)).toEqual(['q1']);
    expect(plan.toNotifyOnly).toEqual([]);
  });
});
