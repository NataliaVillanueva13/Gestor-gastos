import pg from 'pg';

// DATE (oid 1082) se devuelve como texto 'YYYY-MM-DD' y no como Date,
// para evitar corrimientos por zona horaria.
pg.types.setTypeParser(1082, (valor) => valor);
// NUMERIC (oid 1700) se convierte a número para el JSON.
pg.types.setTypeParser(1700, (valor) => Number(valor));

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const query = (texto, params) => pool.query(texto, params);
