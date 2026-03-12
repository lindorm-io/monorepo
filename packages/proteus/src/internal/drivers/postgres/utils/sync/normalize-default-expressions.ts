// Normalizes default expressions from pg_get_expr() for comparison
// against desired defaults from entity metadata.
//
// PG stores defaults with type casts and extra parens that we strip:
//   'hello'::text          → 'hello'
//   'active'::enum_status  → 'active'
//   (0)::integer           → 0
//   true                   → true
//   NULL::text             → null

// Trailing type cast pattern: :: followed by a PG type identifier
// Handles: simple types (::text), schema-qualified (::schema.type or ::"public"."enum_name"),
// types with precision (::numeric(10,2)), and compound names (::timestamp(3) with time zone)
// Does NOT match casts inside function calls: date_trunc('day'::text, now())
const TRAILING_CAST =
  /::(?:(?:"[^"]*"|[a-zA-Z_]\w*)\.)?(?:"[^"]*"|[a-zA-Z_]\w*)(?:\(\d+(?:\s*,\s*\d+)?\))?(?:\[\])*(?:\s+[a-zA-Z]+)*$/;

const stripParens = (s: string): string => {
  let result = s;
  while (result.startsWith("(") && result.endsWith(")")) {
    const inner = result.slice(1, -1);
    let depth = 0;
    let balanced = true;
    for (const ch of inner) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (depth < 0) {
        balanced = false;
        break;
      }
    }
    if (balanced && depth === 0) {
      result = inner;
    } else {
      break;
    }
  }
  return result;
};

/**
 * Normalizes `pg_get_expr()` default expressions for comparison against desired defaults.
 * Strips trailing type casts (`::text`, `::integer`), outer parentheses, and canonicalizes
 * `NULL::type` to `null`. This allows direct string comparison between introspected and
 * desired default values.
 */
export const normalizeDefaultExpressions = (expr: string | null): string | null => {
  if (expr == null) return null;

  let s = expr.trim();

  // Strip leading/trailing parens: ((expr)) → expr
  s = stripParens(s);

  // Strip trailing type casts iteratively: 'value'::type1::type2
  while (true) {
    const before = s;
    s = s.replace(TRAILING_CAST, "");
    if (s === before) break;
  }

  // Strip parens again after cast removal
  s = stripParens(s);

  // Normalize NULL
  if (s.toUpperCase() === "NULL") return null;

  return s;
};
