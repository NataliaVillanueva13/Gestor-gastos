import { query } from './db.js';

// Observabilidad y presupuesto de la IA. Cada llamada al modelo deja una fila en llamadas_ia.

// Registra una llamada. Nunca rompe el pedido: si la base falla, solo se avisa en consola.
export async function registrarLlamada(t) {
  try {
    await query(
      `INSERT INTO llamadas_ia (usuario_id, funcion, version_prompt, modelo, respaldo,
         tokens_entrada, tokens_salida, latencia_ms, resultado, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        t.usuarioId ?? null,
        t.funcion,
        t.version,
        t.modelo ?? '-',
        t.respaldo ?? false,
        t.tokensEntrada ?? 0,
        t.tokensSalida ?? 0,
        t.latenciaMs ?? 0,
        t.resultado,
        t.error ? String(t.error).slice(0, 40) : null,
      ],
    );
  } catch (err) {
    console.error(`[ia] no se pudo registrar la traza: ${err.message}`);
  }
}

// ---------- Presupuesto diario (LLM10 · consumo sin límites) ----------
// Tope global de tokens por día para toda la app: alerta al 80 %, corte al 100 %.

const limiteDiario = () => Number(process.env.IA_LIMITE_DIARIO_TOKENS) || 200_000;
let ultimaAlerta = '';

export async function verificarPresupuesto() {
  const { rows } = await query(
    `SELECT COALESCE(SUM(tokens_entrada + tokens_salida), 0)::int AS usados
     FROM llamadas_ia WHERE creado_en >= date_trunc('day', now())`,
  );
  const usados = rows[0].usados;
  const limite = limiteDiario();
  const hoy = new Date().toISOString().slice(0, 10);
  if (usados >= limite * 0.8 && ultimaAlerta !== hoy) {
    ultimaAlerta = hoy;
    console.warn(`[ia] ALERTA: se usó el ${Math.round((usados / limite) * 100)} % del presupuesto diario (${usados} de ${limite} tokens)`);
  }
  return { usados, limite, agotado: usados >= limite };
}

// ---------- Métricas agregadas ----------

const precio = (nombre) => Number(process.env[nombre]) || 0; // USD por millón de tokens

export async function metricas({ dias = 7 } = {}) {
  const pe = precio('IA_PRECIO_ENTRADA_USD');
  const ps = precio('IA_PRECIO_SALIDA_USD');
  const desde = `now() - make_interval(days => $1::int)`;

  const { rows: porDia } = await query(
    `SELECT to_char(creado_en, 'YYYY-MM-DD') AS dia,
            COUNT(*)::int AS llamadas,
            COUNT(*) FILTER (WHERE resultado = 'error')::int AS errores,
            COUNT(*) FILTER (WHERE resultado = 'salida_invalida')::int AS salidas_invalidas,
            COUNT(*) FILTER (WHERE resultado = 'bloqueada')::int AS inyecciones_bloqueadas,
            COUNT(*) FILTER (WHERE respaldo)::int AS con_respaldo,
            SUM(tokens_entrada)::int AS tokens_entrada,
            SUM(tokens_salida)::int AS tokens_salida,
            ROUND((SUM(tokens_entrada) * $2::numeric + SUM(tokens_salida) * $3::numeric) / 1e6, 4) AS costo_usd
     FROM llamadas_ia WHERE creado_en >= ${desde}
     GROUP BY 1 ORDER BY 1`,
    [dias, pe, ps],
  );

  const { rows: porFuncion } = await query(
    `SELECT funcion, version_prompt,
            COUNT(*)::int AS llamadas,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY latencia_ms)::int AS p50_ms,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY latencia_ms)::int AS p95_ms,
            ROUND(100.0 * COUNT(*) FILTER (WHERE resultado = 'error') / COUNT(*), 1) AS pct_error,
            ROUND(100.0 * COUNT(*) FILTER (WHERE resultado = 'salida_invalida') / COUNT(*), 1) AS pct_invalida,
            ROUND(AVG(tokens_entrada + tokens_salida))::int AS tokens_prom
     FROM llamadas_ia
     WHERE creado_en >= ${desde} AND resultado <> 'bloqueada'
     GROUP BY 1, 2 ORDER BY 1, 2`,
    [dias],
  );

  const { rows: porUsuario } = await query(
    `SELECT usuario_id, COUNT(*)::int AS llamadas,
            SUM(tokens_entrada + tokens_salida)::int AS tokens,
            ROUND((SUM(tokens_entrada) * $2::numeric + SUM(tokens_salida) * $3::numeric) / 1e6, 4) AS costo_usd
     FROM llamadas_ia WHERE creado_en >= ${desde}
     GROUP BY 1 ORDER BY tokens DESC NULLS LAST LIMIT 10`,
    [dias, pe, ps],
  );

  const { rows: errores } = await query(
    `SELECT error, COUNT(*)::int AS veces FROM llamadas_ia
     WHERE creado_en >= ${desde} AND error IS NOT NULL
     GROUP BY 1 ORDER BY 2 DESC`,
    [dias],
  );

  return { porDia, porFuncion, porUsuario, errores, conPrecios: Boolean(pe || ps) };
}
