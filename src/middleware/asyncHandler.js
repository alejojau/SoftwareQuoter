/**
 * Envuelve un handler async para que sus rechazos lleguen a next(err) en
 * vez de perderse como una promesa no manejada.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
