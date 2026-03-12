/**
 * Classifies how a column type change should be handled: `"none"` (types match),
 * `"alter"` (safe implicit cast), `"alter_using"` (explicit USING clause needed),
 * or `"drop_readd"` (incompatible — requires dropping and recreating the column).
 * Handles VARCHAR(N)→VARCHAR widening as a safe cast. Normalized types are compared
 * in uppercase after alias resolution.
 */
export type TypeCastResult =
  | { action: "none" }
  | { action: "alter" }
  | { action: "alter_using"; using: string }
  | { action: "drop_readd" };

// Safe implicit casts — PG handles these without USING
const SAFE_CASTS = new Set([
  "SMALLINT->INTEGER",
  "SMALLINT->BIGINT",
  "INTEGER->BIGINT",
  "REAL->DOUBLE PRECISION",
  "VARCHAR->TEXT",
]);

// Casts that need an explicit USING clause
const USING_CASTS: Record<string, string> = {
  "TEXT->UUID": "col::uuid",
  "TEXT->INTEGER": "col::integer",
  "TEXT->BIGINT": "col::bigint",
  "TEXT->SMALLINT": "col::smallint",
  "TEXT->BOOLEAN": "col::boolean",
  "TEXT->REAL": "col::real",
  "TEXT->DOUBLE PRECISION": "col::double precision",
  "TEXT->NUMERIC": "col::numeric",
  "INTEGER->TEXT": "col::text",
  "BIGINT->TEXT": "col::text",
  "SMALLINT->TEXT": "col::text",
  "UUID->TEXT": "col::text",
  "BOOLEAN->TEXT": "col::text",
  "REAL->TEXT": "col::text",
  "DOUBLE PRECISION->TEXT": "col::text",
  "NUMERIC->TEXT": "col::text",
  "INTEGER->REAL": "col::real",
  "INTEGER->DOUBLE PRECISION": "col::double precision",
  "INTEGER->NUMERIC": "col::numeric",
  "BIGINT->NUMERIC": "col::numeric",
  "BIGINT->DOUBLE PRECISION": "col::double precision",
};

const stripParams = (type: string): string => type.replace(/\(.*\)/, "").trim();

const isVarcharWiden = (from: string, to: string): boolean => {
  const fromMatch = from.match(/^VARCHAR\((\d+)\)$/);
  // VARCHAR(N) → VARCHAR (unlimited) is always a safe widen
  if (fromMatch && to === "VARCHAR") return true;
  const toMatch = to.match(/^VARCHAR\((\d+)\)$/);
  if (fromMatch && toMatch) {
    return Number(toMatch[1]) >= Number(fromMatch[1]);
  }
  return false;
};

export const classifyTypeCast = (from: string, to: string): TypeCastResult => {
  if (from === to) return { action: "none" };

  // VARCHAR(N) → VARCHAR(M) where M >= N — safe widen
  if (isVarcharWiden(from, to)) return { action: "alter" };

  // VARCHAR(N) → VARCHAR(M) where M < N — needs USING (truncation)
  const fromVarchar = from.match(/^VARCHAR\((\d+)\)$/);
  const toVarchar = to.match(/^VARCHAR\((\d+)\)$/);
  if (fromVarchar && toVarchar && Number(toVarchar[1]) < Number(fromVarchar[1])) {
    return { action: "alter_using", using: `col::varchar(${toVarchar[1]})` };
  }

  // TEXT → VARCHAR(N) — needs USING (potential truncation); TEXT → VARCHAR (unlimited) is safe
  if (from === "TEXT") {
    const toVarcharN = to.match(/^VARCHAR\((\d+)\)$/);
    if (toVarcharN) {
      return { action: "alter_using", using: `col::varchar(${toVarcharN[1]})` };
    }
    if (to === "VARCHAR") {
      return { action: "alter" };
    }
  }

  // Normalize for lookup — strip precision/scale params
  const fromBase = stripParams(from);
  const toBase = stripParams(to);

  if (fromBase === toBase) {
    // Check for precision narrowing in NUMERIC and TIMESTAMPTZ
    if (fromBase === "NUMERIC") {
      const fromPrec = from.match(/^NUMERIC\((\d+)(?:\s*,\s*(\d+))?\)$/);
      const toPrec = to.match(/^NUMERIC\((\d+)(?:\s*,\s*(\d+))?\)$/);
      if (fromPrec && toPrec) {
        const fromPrecision = Number(fromPrec[1]);
        const toPrecision = Number(toPrec[1]);
        const fromScale = Number(fromPrec[2] ?? 0);
        const toScale = Number(toPrec[2] ?? 0);
        if (toPrecision < fromPrecision || toScale < fromScale) {
          const scale = toPrec[2] ? `, ${toPrec[2]}` : "";
          return { action: "alter_using", using: `col::numeric(${toPrec[1]}${scale})` };
        }
      }
    }
    if (fromBase === "TIMESTAMPTZ") {
      const fromPrec = from.match(/^TIMESTAMPTZ\((\d+)\)$/);
      const toPrec = to.match(/^TIMESTAMPTZ\((\d+)\)$/);
      if (fromPrec && toPrec && Number(toPrec[1]) < Number(fromPrec[1])) {
        return { action: "alter_using", using: `col::timestamptz(${toPrec[1]})` };
      }
    }

    // Same base type, different params — widening or no precision change
    return { action: "alter" };
  }

  // Check safe implicit casts
  const key = `${fromBase}->${toBase}`;
  if (SAFE_CASTS.has(key)) return { action: "alter" };

  // Check USING casts
  const using = USING_CASTS[key];
  if (using) return { action: "alter_using", using };

  // Everything else — drop and re-add
  return { action: "drop_readd" };
};
