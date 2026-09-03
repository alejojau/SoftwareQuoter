const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { NotFoundError, ConflictError } = require('../errors/AppError');
const { assertProjectMember } = require('../services/authorization');
const { createMessage } = require('../services/messages.service');

const answerSchema = z.object({ answerText: z.string().min(1) });

function buildPendingQuestionsRouter(prisma, emitters) {
  const router = Router();

  // Responder un ask_user (§3.1). Deja la respuesta también como mensaje
  // de chat, para que quede en el mismo timeline que el resto de la
  // conversación del proyecto (§6).
  router.post(
    '/:id/answer',
    asyncHandler(async (req, res) => {
      const data = answerSchema.parse(req.body);
      const question = await prisma.pendingQuestion.findUnique({ where: { id: req.params.id } });
      if (!question) throw new NotFoundError('Pregunta no encontrada');
      await assertProjectMember(prisma, question.projectId, req.currentUser.id);
      if (question.status !== 'ABIERTA') {
        throw new ConflictError('Esta pregunta ya no está abierta');
      }

      const updated = await prisma.pendingQuestion.update({
        where: { id: req.params.id },
        data: {
          status: 'RESPONDIDA',
          answeredAt: new Date(),
          answeredByUserId: req.currentUser.id,
        },
      });

      const message = await createMessage({
        prisma,
        projectId: question.projectId,
        actor: { type: 'USUARIO', userId: req.currentUser.id },
        content: data.answerText,
        documentNodeId: question.documentNodeId,
      });

      emitters.emitMessage(question.projectId, message);

      res.json(updated);
    })
  );

  return router;
}

module.exports = buildPendingQuestionsRouter;
