// Canonicalizes format_type() output from pg_catalog to uppercase forms
// that match the output of mapFieldType(). This allows direct string
// comparison between introspected DB types and desired types.

const ALIASES: Record<string, string> = {
  boolean: "BOOLEAN",
  smallint: "SMALLINT",
  integer: "INTEGER",
  bigint: "BIGINT",
  real: "REAL",
  "double precision": "DOUBLE PRECISION",
  text: "TEXT",
  uuid: "UUID",
  date: "DATE",
  "timestamp without time zone": "TIMESTAMP",
  "time without time zone": "TIME",
  "time with time zone": "TIMETZ",
  interval: "INTERVAL",
  bytea: "BYTEA",
  jsonb: "JSONB",
  json: "JSON",
  inet: "INET",
  cidr: "CIDR",
  macaddr: "MACADDR",
  point: "POINT",
  line: "LINE",
  lseg: "LSEG",
  box: "BOX",
  path: "PATH",
  polygon: "POLYGON",
  circle: "CIRCLE",
  xml: "XML",
};

const PARAMETRIC_PATTERNS: Array<{
  regex: RegExp;
  format: (match: RegExpMatchArray) => string;
}> = [
  // timestamp(N) with time zone → TIMESTAMPTZ(N)
  {
    regex: /^timestamp\((\d+)\) with time zone$/,
    format: (m) => `TIMESTAMPTZ(${m[1]})`,
  },
  // timestamp with time zone → TIMESTAMPTZ(6) (PG default precision)
  {
    regex: /^timestamp with time zone$/,
    format: () => "TIMESTAMPTZ(6)",
  },
  // character varying(N) → VARCHAR(N)
  {
    regex: /^character varying\((\d+)\)$/,
    format: (m) => `VARCHAR(${m[1]})`,
  },
  // character varying (no limit) → TEXT
  {
    regex: /^character varying$/,
    format: () => "TEXT",
  },
  // numeric(P,S) → NUMERIC(P, S) or numeric(P) → NUMERIC(P) or numeric → NUMERIC
  {
    regex: /^numeric\((\d+),(\d+)\)$/,
    format: (m) => `NUMERIC(${m[1]}, ${m[2]})`,
  },
  {
    regex: /^numeric\((\d+)\)$/,
    format: (m) => `NUMERIC(${m[1]})`,
  },
  {
    regex: /^numeric$/,
    format: () => "NUMERIC",
  },
  // array types: e.g. "integer[]" → "INTEGER[]"
  {
    regex: /^(.+)\[\]$/,
    format: (m) => `${normalizePgType(m[1])}[]`,
  },
  // vector(N) → VECTOR(N) or vector → VECTOR
  {
    regex: /^vector\((\d+)\)$/,
    format: (m) => `VECTOR(${m[1]})`,
  },
  {
    regex: /^vector$/,
    format: () => "VECTOR",
  },
];

/**
 * Canonicalizes `format_type()` output from `pg_catalog` to uppercase forms matching
 * `mapFieldType()` output. Handles aliases (e.g. `"timestamp without time zone"` → `"TIMESTAMP"`),
 * VARCHAR precision extraction, NUMERIC precision/scale, TIMESTAMPTZ precision, and array types.
 */
export const normalizePgType = (formatTypeOutput: string): string => {
  const lower = formatTypeOutput.toLowerCase().trim();

  // Direct alias match
  const alias = ALIASES[lower];
  if (alias) return alias;

  // Parametric pattern match
  for (const { regex, format } of PARAMETRIC_PATTERNS) {
    const match = lower.match(regex);
    if (match) return format(match);
  }

  // USER-DEFINED types (enums) — strip double-quotes for consistent comparison
  // format_type() returns unquoted: schema.enum_name
  // desired pgType uses quoted: "schema"."enum_name"
  // Stripping quotes normalizes both to the same form
  return formatTypeOutput.replace(/"/g, "");
};
