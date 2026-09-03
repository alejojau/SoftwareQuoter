const { ConflictError } = require('../errors/AppError');

/**
 * RF-25: acumula un ajuste sobre pendingChanges del borrador de trabajo,
 * sin crear una DocumentVersion nueva. No muta el array recibido.
 */
function addPendingChange(documentNode, change) {
  const pending = Array.isArray(documentNode.pendingChanges)
    ? documentNode.pendingChanges
    : [];

  return [
    ...pending,
    {
      summary: change.summary,
      authorType: change.authorType,
      authorUserId: change.authorUserId ?? null,
      authorAgent: change.authorAgent ?? null,
      at: new Date().toISOString(),
    },
  ];
}

/**
 * RF-26: construye los datos de la DocumentVersion que consolida todo lo
 * acumulado en pendingChanges. Rechaza checkpointear un documento que ya
 * tiene una versión y no acumuló nada nuevo — el checkpoint debe ser
 * siempre una acción intencional sobre un cambio real, nunca un no-op
 * silencioso. La primera versión de un documento (currentVersionId nulo)
 * siempre se permite, aunque pendingChanges esté vacío.
 */
function buildCheckpointVersion(documentNode, { content, actor }) {
  const pending = Array.isArray(documentNode.pendingChanges)
    ? documentNode.pendingChanges
    : [];

  if (pending.length === 0 && documentNode.currentVersionId) {
    throw new ConflictError(
      'No hay cambios pendientes por confirmar en este documento'
    );
  }

  return {
    content,
    changesSummary: pending,
    generatedByAgent: actor.type === 'AGENTE' ? actor.agent : null,
    generatedByUserId: actor.type === 'USUARIO' ? actor.userId : null,
    approvedByType: actor.type,
    approvedByUserId: actor.type === 'USUARIO' ? actor.userId : null,
  };
}

module.exports = { addPendingChange, buildCheckpointVersion };
