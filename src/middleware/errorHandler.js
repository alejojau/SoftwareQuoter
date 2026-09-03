const { ZodError } = require('zod');
const { AppError } = require('../errors/AppError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', details: err.issues });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;
