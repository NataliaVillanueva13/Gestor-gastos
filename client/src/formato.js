const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
});

export const dinero = (n) => pesos.format(n ?? 0);

const dosDigitos = (n) => String(n).padStart(2, '0');

// Fecha y mes locales (no UTC) para que "hoy" sea el de la persona.
export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}
export const mesActual = () => hoy().slice(0, 7);

export function sumarMeses(mes, n) {
  const [anio, m] = mes.split('-').map(Number);
  const total = anio * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${dosDigitos((total % 12) + 1)}`;
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export function nombreMes(mes, corto = false) {
  const [anio, m] = mes.split('-').map(Number);
  const nombre = MESES[m - 1];
  return corto ? `${nombre.slice(0, 3)} ${String(anio).slice(2)}` : `${nombre} de ${anio}`;
}

export function fechaCorta(fecha) {
  const [, m, d] = fecha.split('-');
  return `${d}/${m}`;
}

export const MEDIOS = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
};
