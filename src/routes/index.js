const { Router } = require('express');
const currentUser = require('../middleware/currentUser');
const buildWorkspacesRouter = require('./workspaces.routes');
const buildProjectsRouter = require('./projects.routes');
const buildDocumentNodesRouter = require('./documentNodes.routes');
const buildPendingQuestionsRouter = require('./pendingQuestions.routes');

function buildRouter(prisma, emitters) {
  const router = Router();

  router.use(currentUser(prisma));

  router.use('/workspaces', buildWorkspacesRouter(prisma));
  router.use('/projects', buildProjectsRouter(prisma, emitters));
  router.use('/document-nodes', buildDocumentNodesRouter(prisma, emitters));
  router.use('/pending-questions', buildPendingQuestionsRouter(prisma, emitters));

  return router;
}

module.exports = buildRouter;
