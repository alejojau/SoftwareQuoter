const asyncHandler = require('./asyncHandler');
const { UnauthorizedError } = require('../errors/AppError');

/**
 * Stub de autenticación. El mecanismo de identidad/sesión real no está
 * definido todavía en el diseño (no hay RF/RNF para eso), así que este
 * middleware identifica al usuario actual por el header `X-User-Id` para
 * poder construir y probar el resto de la API contra usuarios reales de
 * la tabla `users`. Reemplazar por el mecanismo real cuando se diseñe.
 */
function currentUser(prisma) {
  return asyncHandler(async (req, res, next) => {
    const userId = req.header('X-User-Id');
    if (!userId) {
      throw new UnauthorizedError('Falta el header X-User-Id');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    req.currentUser = user;
    next();
  });
}

module.exports = currentUser;
