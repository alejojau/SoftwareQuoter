const { ForbiddenError } = require('../errors/AppError');

/**
 * RF-02: solo los miembros de un proyecto pueden interactuar con él. Esto
 * es el control de acceso mínimo (pertenencia); la autorización más fina
 * por rol y tipo de acción (§5 Roles y aprobación — quién aprueba cada
 * documento) queda como trabajo pendiente, no implementada todavía.
 */
async function assertProjectMember(prisma, projectId, userId) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) {
    throw new ForbiddenError('No perteneces a este proyecto');
  }
  return membership;
}

module.exports = { assertProjectMember };
