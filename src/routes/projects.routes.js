const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { NotFoundError } = require('../errors/AppError');

const addMemberSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.enum(['NEGOCIO', 'ANALISTA', 'ARQUITECTO'])).min(1),
});

const createMessageSchema = z.object({
  content: z.string().min(1),
  documentNodeId: z.string().optional(),
});

function buildProjectsRouter(prisma) {
  const router = Router();

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const project = await prisma.project.findUnique({
        where: { id: req.params.id },
        include: { members: true, documentNodes: true },
      });
      if (!project) throw new NotFoundError('Proyecto no encontrado');
      res.json(project);
    })
  );

  // RF-01: pausar/retomar sin afectar a los demás proyectos del workspace.
  router.post(
    '/:id/pause',
    asyncHandler(async (req, res) => {
      const project = await prisma.project.update({
        where: { id: req.params.id },
        data: { state: 'PAUSADO', pausedAt: new Date() },
      });
      res.json(project);
    })
  );

  router.post(
    '/:id/resume',
    asyncHandler(async (req, res) => {
      const project = await prisma.project.update({
        where: { id: req.params.id },
        data: { pausedAt: null },
      });
      res.json(project);
    })
  );

  // RF-02: un usuario puede tener varios roles en el mismo proyecto;
  // upsert para que asignar de nuevo simplemente actualice los roles.
  router.post(
    '/:id/members',
    asyncHandler(async (req, res) => {
      const data = addMemberSchema.parse(req.body);
      const member = await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: req.params.id, userId: data.userId } },
        create: { projectId: req.params.id, userId: data.userId, roles: data.roles },
        update: { roles: data.roles },
      });
      res.status(201).json(member);
    })
  );

  router.get(
    '/:id/document-nodes',
    asyncHandler(async (req, res) => {
      const nodes = await prisma.documentNode.findMany({
        where: { projectId: req.params.id },
        include: { currentVersion: true },
      });
      res.json(nodes);
    })
  );

  router.get(
    '/:id/messages',
    asyncHandler(async (req, res) => {
      const chatSession = await prisma.chatSession.findUnique({
        where: { projectId: req.params.id },
      });
      if (!chatSession) throw new NotFoundError('Proyecto sin chat asociado');

      const messages = await prisma.message.findMany({
        where: { chatSessionId: chatSession.id },
        orderBy: { createdAt: 'asc' },
      });
      res.json(messages);
    })
  );

  // Interfaz REST simple para el chat (§6). El transporte en vivo por
  // WebSocket (ADR-0003) todavía no está implementado — este endpoint es
  // la base de datos sobre la que se conecta ese transporte más adelante,
  // y ya sirve para probar el resto del flujo sin él.
  router.post(
    '/:id/messages',
    asyncHandler(async (req, res) => {
      const data = createMessageSchema.parse(req.body);
      const chatSession = await prisma.chatSession.findUnique({
        where: { projectId: req.params.id },
      });
      if (!chatSession) throw new NotFoundError('Proyecto sin chat asociado');

      const message = await prisma.message.create({
        data: {
          chatSessionId: chatSession.id,
          projectId: req.params.id,
          authorType: 'USUARIO',
          authorUserId: req.currentUser.id,
          content: data.content,
          documentNodeId: data.documentNodeId,
        },
      });
      res.status(201).json(message);
    })
  );

  return router;
}

module.exports = buildProjectsRouter;
