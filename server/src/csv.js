// Excel en español (Argentina) espera ';' como separador y ',' como decimal.
// Si lo abrís en otro programa, cambiá estas dos constantes.
const SEPARADOR = ';';
const DECIMAL = ',';

// Evita "inyección de fórmulas": una celda que empieza con = + - @ se ejecutaría en Excel.
function celda(valor) {
  let texto = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  if (/[";\n\r]/.test(texto)) texto = `"${texto.replaceAll('"', '""')}"`;
  return texto;
}

export function gastosACsv(filas) {
  const encabezado = ['Fecha', 'Categoría', 'Descripción', 'Medio de pago', 'Monto'];
  const lineas = filas.map((f) =>
    [
      f.fecha,
      f.categoria,
      f.descripcion,
      f.medio_pago,
      Number(f.monto).toFixed(2).replace('.', DECIMAL),
    ]
      .map(celda)
      .join(SEPARADOR),
  );
  // BOM para que Excel respete los acentos
  return '﻿' + [encabezado.join(SEPARADOR), ...lineas].join('\r\n') + '\r\n';
}
