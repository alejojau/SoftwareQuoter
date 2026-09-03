const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { NotFoundError } = require('../errors/AppError');

const createWorkspaceSchema = z.object({
  name: z.string().min(1),
  brandingLogoUrl: z.string().url().optional(),
});

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

function buildWorkspacesRouter(prisma) {
  const router = Router();

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const data = createWorkspaceSchema.parse(req.body);
      const workspace = await prisma.workspace.create({ data });
      res.status(201).json(workspace);
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const workspace = await prisma.workspace.findUnique({
        where: { id: req.params.id },
        include: { projects: true },
      });
      if (!workspace) throw new NotFoundError('Workspace no encontrado');
      res.json(workspace);
    })
  );

  // RF-01: crear un proyecto dentro del Workspace. Arranca con el
  // DocumentNode del Business Brief y su ChatSession ya creados, listos
  // para que el Elicitador empiece la conversación (RF-03).
  router.post(
    '/:id/projects',
    asyncHandler(async (req, res) => {
      const data = createProjectSchema.parse(req.body);
      const workspace = await prisma.workspace.findUnique({ where: { id: req.params.id } });
      if (!workspace) throw new NotFoundError('Workspace no encontrado');

      const project = await prisma.project.create({
        data: { ...data, workspaceId: workspace.id },
      });

      await prisma.documentNode.create({
        data: { projectId: project.id, type: 'BUSINESS_BRIEF', state: 'PENDIENTE' },
      });
      await prisma.chatSession.create({ data: { projectId: project.id } });

      res.status(201).json(project);
    })
  );

  // RF-20 / RNF-08: bandeja de pendientes agregada a nivel de Workspace —
  // todas las preguntas ABIERTA de todos los proyectos de este workspace,
  // para que una pregunta bloqueante no se pierda si el usuario está
  // mirando otro proyecto.
  router.get(
    '/:id/pending-questions',
    asyncHandler(async (req, res) => {
      const questions = await prisma.pendingQuestion.findMany({
        where: { status: 'ABIERTA', project: { workspaceId: req.params.id } },
        orderBy: { createdAt: 'asc' },
        include: { project: true, documentNode: true },
      });
      res.json(questions);
    })
  );

  return router;
}

module.exports = buildWorkspacesRouter;
