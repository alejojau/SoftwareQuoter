const { NotFoundError } = require('../errors/AppError');
const { buildCheckpointVersion } = require('../domain/checkpoint');
const { computeInvalidationPlan } = require('../domain/invalidation');

/**
 * RF-25/RF-26 + §4: consolida los cambios pendientes de un DocumentNode en
 * una DocumentVersion nueva y, si hay documentos aguas abajo que ya
 * existen, dispara el motor evolutivo (ChangeEvent + InvalidationRun),
 * marcando obsoleto lo que corresponda y auto-regenerando solo lo que
 * RF-17 permite.
 *
 * Todo corre en una única transacción: o se consolida la versión y se
 * propaga la invalidación completa, o no se aplica nada.
 */
async function confirmCheckpoint({ prisma, documentNodeId, content, actor, projectConfig = {} }) {
  return prisma.$transaction(async (tx) => {
    const node = await tx.documentNode.findUnique({ where: { id: documentNodeId } });
    if (!node) throw new NotFoundError('Documento no encontrado');

    const versionData = buildCheckpointVersion(node, { content, actor });

    const previousVersionCount = await tx.documentVersion.count({
      where: { documentNodeId },
    });

    const version = await tx.documentVersion.create({
      data: {
        documentNodeId,
        number: previousVersionCount + 1,
        content: versionData.content,
        generatedByAgent: versionData.generatedByAgent,
        generatedByUserId: versionData.generatedByUserId,
        approvedByType: versionData.approvedByType,
        approvedByUserId: versionData.approvedByUserId,
        approvedAt: new Date(),
      },
    });

    const updatedNode = await tx.documentNode.update({
      where: { id: documentNodeId },
      data: { state: 'APROBADO', currentVersionId: version.id, pendingChanges: [] },
    });

    const siblingNodes = await tx.documentNode.findMany({
      where: { projectId: node.projectId },
    });
    const nodesByType = Object.fromEntries(siblingNodes.map((n) => [n.type, n]));

    const plan = computeInvalidationPlan(node.type, nodesByType, projectConfig);

    let changeEvent = null;
    let invalidationRun = null;

    if (plan.toInvalidate.length > 0) {
      changeEvent = await tx.changeEvent.create({
        data: {
          projectId: node.projectId,
          documentNodeId,
          triggeredVersionId: version.id,
          origin: actor.type === 'USUARIO' ? 'EDICION_HUMANA' : 'REGENERACION_AGENTE',
        },
      });

      invalidationRun = await tx.invalidationRun.create({
        data: {
          changeEventId: changeEvent.id,
          invalidatedNodeIds: plan.toInvalidate.map((n) => n.id),
          regeneratedNodeIds: [],
          state: 'EN_CURSO',
        },
      });

      await tx.documentNode.updateMany({
        where: { id: { in: plan.toInvalidate.map((n) => n.id) } },
        data: { state: 'OBSOLETO' },
      });

      // Los nodos auto-regenerables quedan marcados REGENERANDO. La
      // ejecución real del agente que produce la nueva versión es un job
      // de la cola de trabajos (ADR-0002) — todavía no implementada; este
      // es el punto de enganche donde ese futuro worker toma el trabajo.
      if (plan.toAutoRegenerate.length > 0) {
        await tx.documentNode.updateMany({
          where: { id: { in: plan.toAutoRegenerate.map((n) => n.id) } },
          data: { state: 'REGENERANDO' },
        });
      }
    }

    return { documentNode: updatedNode, version, changeEvent, invalidationRun, invalidation: plan };
  });
}

module.exports = { confirmCheckpoint };
