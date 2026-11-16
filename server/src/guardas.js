// Guardas para el texto que viaja al modelo (capítulo 8: defensa en capas).
// Funciones puras, sin dependencias: se testean en test/guardas.test.js.

// ---------- Capa 03 · Aislar: delimitar y escapar ----------

// Neutraliza los signos < y > para que un texto no pueda abrir ni cerrar etiquetas
// (por ejemplo, un "</pregunta>" falso que "cierre" el bloque antes de tiempo).
// También saca caracteres de control. En una frase de gastos, < y > no aportan nada.
export function limpiar(texto) {
  return String(texto ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replaceAll('<', '‹')
    .replaceAll('>', '›');
}

// Envuelve un dato externo en una etiqueta, ya limpio.
export function delimitar(etiqueta, texto) {
  return `<${etiqueta}>\n${limpiar(texto)}\n</${etiqueta}>`;
}

// ---------- PII: redactar antes de enviar a terceros ----------

// Saca del texto datos personales que no hacen falta para entender un gasto:
// emails, números de tarjeta, CBU/CVU, teléfonos con prefijo internacional y
// cualquier número de 10 dígitos o más (ningún monto válido llega a 10 dígitos).
// No se tocan números cortos: un DNI con puntos se confunde con un monto ("30.123.456").
export function redactarPII(texto) {
  return String(texto ?? '')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,7}\b/g, '[número]') // tarjeta con separadores
    .replace(/\+\d[\d -]{8,}\d/g, '[teléfono]')
    .replace(/\d{10,}/g, '[número]');
}

// ---------- Capa 02 · Filtrar: intentos obvios de inyección ----------

// No pretende atrapar todo (ningún filtro es perfecto): frena lo evidente antes de gastar
// tokens, y cada detección queda registrada como métrica. Las demás capas siguen en pie.
const PATRONES_INYECCION = [
  /\bignor\w*\b.{0,40}\b(instruc\w*|indicacion\w*|reglas|anterior\w*|todo)\b/,
  /\bolvid\w*\b.{0,40}\b(instruc\w*|reglas|anterior\w*|todo)\b/,
  /\b(system ?prompt|prompt (de|del) sistema|mensaje (de|del) sistema)\b/,
  /\b(mostr|muestr|revel|repet|escrib|copi|dec[ií])\w*\b.{0,40}\b(tus|las|el) (instruc\w*|reglas|prompt)\b/,
  /\b(nuevas|otras) instrucciones\b/,
  /\b(a partir de ahora|desde ahora) (sos|eres|actua\w*|respond\w*)\b/,
  /\b(jailbreak|modo desarrollador|developer mode)\b/,
  /\b(ignore|disregard|forget)\b.{0,40}\b(instructions|previous|above|rules)\b/,
  /‹\/?\s*(system|assistant|user|pregunta|frase_usuario|datos)\b/,
  // "Sistema: …" o "asistente: …" al empezar una línea o después de un separador
  /(^|[.;:!?\-—]\s*)(system|assistant|asistente|sistema)\s*:/m,
];

// Minúsculas, sin acentos y con < > ya neutralizados, para comparar.
const normalizar = (t) =>
  limpiar(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function pareceInyeccion(texto) {
  const t = normalizar(texto);
  return PATRONES_INYECCION.some((re) => re.test(t));
}
