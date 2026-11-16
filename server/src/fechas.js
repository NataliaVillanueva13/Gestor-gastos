// Trabajamos con meses como texto 'YYYY-MM' y fechas como 'YYYY-MM-DD'.

export const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

export function sumarMeses(mes, n) {
  const [anio, m] = mes.split('-').map(Number);
  const total = anio * 12 + (m - 1) + n;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = (total % 12) + 1;
  return `${nuevoAnio}-${String(nuevoMes).padStart(2, '0')}`;
}

// ['2026-10-01', '2026-11-01'] para consultar fecha >= desde AND fecha < hasta
export function rangoMes(mes) {
  return [`${mes}-01`, `${sumarMeses(mes, 1)}-01`];
}
