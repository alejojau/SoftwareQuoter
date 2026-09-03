const { getDownstreamTypes } = require('./documentGraph');

/**
 * RF-17: un nodo ya aprobado por un humano no se regenera automáticamente
 * ante una invalidación — se notifica y se espera confirmación, salvo que
 * el proyecto tenga activado `autoRegenerateDrafts`. Un nodo aprobado solo
 * por su agente (sin revisión humana) sí puede regenerarse sin preguntar.
 */
function shouldAutoRegenerate(node, projectConfig = {}) {
  if (node.state !== 'APROBADO') return true;
  if (node.approvedByType === 'AGENTE') return true;
  return Boolean(projectConfig.autoRegenerateDrafts);
}

/**
 * Dado el tipo de documento que se acaba de checkpointear (RF-26) y los
 * DocumentNode existentes del proyecto indexados por tipo, calcula:
 * - toInvalidate: todos los nodos aguas abajo que ya existen (RF-16).
 * - toAutoRegenerate: cuáles de esos se pueden regenerar sin confirmación.
 * - toNotifyOnly: cuáles quedan obsoletos esperando revisión humana (RF-17).
 *
 * Un tipo de documento que todavía no tiene DocumentNode en el proyecto
 * (porque el pipeline no ha llegado ahí) simplemente se omite — no hay
 * nada que invalidar todavía.
 */
function computeInvalidationPlan(changedType, nodesByType, projectConfig = {}) {
  const downstreamTypes = getDownstreamTypes(changedType);

  const toInvalidate = [];
  const toAutoRegenerate = [];
  const toNotifyOnly = [];

  for (const type of downstreamTypes) {
    const node = nodesByType[type];
    if (!node) continue;

    toInvalidate.push(node);

    if (shouldAutoRegenerate(node, projectConfig)) {
      toAutoRegenerate.push(node);
    } else {
      toNotifyOnly.push(node);
    }
  }

  return { toInvalidate, toAutoRegenerate, toNotifyOnly };
}

module.exports = { shouldAutoRegenerate, computeInvalidationPlan };
