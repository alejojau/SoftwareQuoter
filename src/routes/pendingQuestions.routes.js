const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { NotFoundError, ConflictError } = require('../errors/AppError');

const answerSchema = z.object({ answerText: z.string().min(1) });

function buildPendingQuestionsRouter(prisma) {
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

      const chatSession = await prisma.chatSession.findUnique({
        where: { projectId: question.projectId },
      });
      if (chatSession) {
        await prisma.message.create({
          data: {
            chatSessionId: chatSession.id,
            projectId: question.projectId,
            authorType: 'USUARIO',
            authorUserId: req.currentUser.id,
            type: 'TEXTO',
            content: data.answerText,
            documentNodeId: question.documentNodeId,
          },
        });
      }

      res.json(updated);
    })
  );

  return router;
}

module.exports = buildPendingQuestionsRouter;
