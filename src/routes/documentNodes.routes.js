const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { NotFoundError } = require('../errors/AppError');
const { assertProjectMember } = require('../services/authorization');
const { addPendingChange } = require('../domain/checkpoint');
const { confirmCheckpoint } = require('../services/documentNodes.service');

const pendingChangeSchema = z.object({ summary: z.string().min(1) });
const checkpointSchema = z.object({ content: z.record(z.any()) });

function buildDocumentNodesRouter(prisma, emitters) {
  const router = Router();

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const node = await prisma.documentNode.findUnique({
        where: { id: req.params.id },
        include: { currentVersion: true },
      });
      if (!node) throw new NotFoundError('Documento no encontrado');
      res.json(node);
    })
  );

  // RF-25: acumula un ajuste sobre el borrador de trabajo sin crear una
  // DocumentVersion nueva — eso solo pasa en el checkpoint (RF-26).
  router.post(
    '/:id/pending-changes',
    asyncHandler(async (req, res) => {
      const data = pendingChangeSchema.parse(req.body);
      const node = await prisma.documentNode.findUnique({ where: { id: req.params.id } });
      if (!node) throw new NotFoundError('Documento no encontrado');
      await assertProjectMember(prisma, node.projectId, req.currentUser.id);

      const pendingChanges = addPendingChange(node, {
        summary: data.summary,
        authorType: 'USUARIO',
        authorUserId: req.currentUser.id,
      });

      const updated = await prisma.documentNode.update({
        where: { id: req.params.id },
        data: { pendingChanges, state: 'EN_REVISION_HUMANA' },
      });

      emitters.emitDocumentEvent(node.projectId, {
        type: 'PENDING_CHANGE_ADDED',
        documentNodeId: req.params.id,
        documentType: node.type,
        summary: data.summary,
      });

      res.json(updated);
    })
  );

  // RF-26: consolida pendingChanges en una DocumentVersion nueva y
  // dispara el motor evolutivo (§4) sobre lo que dependa de este documento.
  router.post(
    '/:id/checkpoint',
    asyncHandler(async (req, res) => {
      const data = checkpointSchema.parse(req.body);
      const node = await prisma.documentNode.findUnique({ where: { id: req.params.id } });
      if (!node) throw new NotFoundError('Documento no encontrado');
      await assertProjectMember(prisma, node.projectId, req.currentUser.id);

      const result = await confirmCheckpoint({
        prisma,
        documentNodeId: req.params.id,
        content: data.content,
        actor: { type: 'USUARIO', userId: req.currentUser.id },
      });

      emitters.emitDocumentEvent(node.projectId, {
        type: 'CHECKPOINT_CONFIRMED',
        documentNodeId: req.params.id,
        documentType: result.documentNode.type,
        versionNumber: result.version.number,
        invalidated: result.invalidation.toInvalidate.map((n) => ({
          id: n.id,
          type: n.type,
          autoRegenerating: result.invalidation.toAutoRegenerate.some((a) => a.id === n.id),
        })),
      });

      res.status(201).json(result);
    })
  );

  return router;
}

module.exports = buildDocumentNodesRouter;
