export class ApiError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

// Valida con zod y lanza un 400 con los errores por campo.
export function validar(schema, datos) {
  const resultado = schema.safeParse(datos);
  if (!resultado.success) {
    const detalles = {};
    for (const issue of resultado.error.issues) {
      detalles[issue.path.join('.') || 'general'] = issue.message;
    }
    throw new ApiError(400, 'Datos inválidos', detalles);
  }
  return resultado.data;
}

export function manejarErrores(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, detalles: err.detalles });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El archivo es demasiado grande (máximo 4 MB)' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
