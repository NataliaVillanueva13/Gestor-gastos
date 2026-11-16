-- Esquema del Gestor de gastos. Se puede ejecutar más de una vez sin romper nada.

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(80)  NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categorias (
  id                  SERIAL PRIMARY KEY,
  usuario_id          INTEGER       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre              VARCHAR(50)   NOT NULL,
  color               CHAR(7)       NOT NULL DEFAULT '#0d6e6e',
  -- NULL significa "sin presupuesto definido"
  presupuesto_mensual NUMERIC(12,2) CHECK (presupuesto_mensual IS NULL OR presupuesto_mensual >= 0),
  UNIQUE (usuario_id, nombre)
);

CREATE TABLE IF NOT EXISTS gastos (
  id           SERIAL PRIMARY KEY,
  usuario_id   INTEGER       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- RESTRICT: no se puede borrar una categoría que tiene gastos
  categoria_id INTEGER       NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  monto        NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha        DATE          NOT NULL,
  descripcion  VARCHAR(200)  NOT NULL DEFAULT '',
  medio_pago   VARCHAR(20)   NOT NULL DEFAULT 'efectivo'
               CHECK (medio_pago IN ('efectivo','debito','credito','transferencia')),
  creado_en    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gastos_usuario_fecha_idx ON gastos (usuario_id, fecha);
CREATE INDEX IF NOT EXISTS gastos_categoria_idx     ON gastos (categoria_id);

-- Traza de cada llamada al modelo de IA (observabilidad, costos y presupuesto diario).
-- No guarda el texto de la persona ni la respuesta: solo metadatos.
CREATE TABLE IF NOT EXISTS llamadas_ia (
  id             BIGSERIAL    PRIMARY KEY,
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  usuario_id     INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
  funcion        VARCHAR(40)  NOT NULL,  -- carga, preguntas.interpretar, preguntas.redactar
  version_prompt VARCHAR(40)  NOT NULL,
  modelo         VARCHAR(100) NOT NULL,
  respaldo       BOOLEAN      NOT NULL DEFAULT false, -- true si respondió el modelo de respaldo
  tokens_entrada INTEGER      NOT NULL DEFAULT 0,
  tokens_salida  INTEGER      NOT NULL DEFAULT 0,
  latencia_ms    INTEGER      NOT NULL DEFAULT 0,
  resultado      VARCHAR(20)  NOT NULL
                 CHECK (resultado IN ('ok','salida_invalida','error','bloqueada','sin_presupuesto')),
  error          VARCHAR(40)  -- código HTTP o tipo de error, nunca el mensaje completo
);

CREATE INDEX IF NOT EXISTS llamadas_ia_fecha_idx ON llamadas_ia (creado_en);
