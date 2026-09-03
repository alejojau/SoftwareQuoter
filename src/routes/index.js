const { Router } = require('express');
const currentUser = require('../middleware/currentUser');
const buildWorkspacesRouter = require('./workspaces.routes');
const buildProjectsRouter = require('./projects.routes');
const buildDocumentNodesRouter = require('./documentNodes.routes');
const buildPendingQuestionsRouter = require('./pendingQuestions.routes');

function buildRouter(prisma) {
  const router = Router();

  router.use(currentUser(prisma));

  router.use('/workspaces', buildWorkspacesRouter(prisma));
  router.use('/projects', buildProjectsRouter(prisma));
  router.use('/document-nodes', buildDocumentNodesRouter(prisma));
  router.use('/pending-questions', buildPendingQuestionsRouter(prisma));

  return router;
}

module.exports = buildRouter;
