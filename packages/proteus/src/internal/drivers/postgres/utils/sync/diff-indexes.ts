import { isEqual } from "@lindorm/is";
import type { DbIndex } from "../../types/db-snapshot";
import type { DesiredIndex } from "../../types/desired-schema";
import type { SyncOperation } from "../../types/sync-plan";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";

// Normalize WHERE predicates for comparison.
// PG canonical form adds outer parens, type casts, and parens around identifiers:
//   ((status)::text = 'active'::text) → status = 'active'
//   ("deletedAt" IS NOT NULL)         → "deletedAt" IS NOT NULL
const normalizePredicateExpr = (expr: string | null): string | null => {
  if (!expr) return null;
  let s = expr.trim();

  // Strip outer balanced parens (iterative)
  while (s.startsWith("(") && s.endsWith(")")) {
    const inner = s.slice(1, -1);
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
    if (balanced && depth === 0) s = inner.trim();
    else break;
  }

  // Strip type casts: ::type_name, ::schema.type_name, or ::type_name(precision)
  s = s.replace(
    /::[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?(?:\([^)]*\))?/g,
    "",
  );

  // Strip parens around single identifiers: (col) → col, ("col") → "col"
  s = s.replace(/\((\w+)\)/g, "$1");
  s = s.replace(/\("([^"]+)"\)/g, '"$1"');

  // Normalize whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
};

const indexMatches = (db: DbIndex, desired: DesiredIndex): boolean => {
  if (db.unique !== desired.unique) return false;
  if (db.method !== desired.method) return false;
  if (!isEqual(db.columns, desired.columns)) return false;
  if (!isEqual(db.include, desired.include ?? [])) return false;
  if (normalizePredicateExpr(db.where) !== normalizePredicateExpr(desired.where))
    return false;
  return true;
};

/**
 * Diffs DB indexes against desired indexes. Matches by name and compares columns,
 * method, uniqueness, WHERE predicate, and INCLUDE columns. Produces drop+create ops
 * for mismatched indexes. Concurrent index creation is preserved in the output.
 */
export const diffIndexes = (
  dbIndexes: Array<DbIndex>,
  desiredIndexes: Array<DesiredIndex>,
  schema: string,
  table: string,
): Array<SyncOperation> => {
  const ops: Array<SyncOperation> = [];
  const q = quoteQualifiedName(schema, table);

  const dbByName = new Map(dbIndexes.map((i) => [i.name, i]));
  const desiredByName = new Map(desiredIndexes.map((i) => [i.name, i]));

  // Drop indexes that no longer exist or have changed (indexes can't be ALTERed)
  for (const [name, db] of dbByName) {
    const desired = desiredByName.get(name);

    if (!desired || !indexMatches(db, desired)) {
      ops.push({
        type: "drop_index",
        severity: "safe",
        schema,
        table,
        description: `Drop index ${quoteIdentifier(name)} from ${q}`,
        sql: `DROP INDEX IF EXISTS ${quoteQualifiedName(schema, name)};`,
        autocommit: false,
      });
    }
  }

  // Create indexes that are new or were dropped above (changed)
  for (const [name, desired] of desiredByName) {
    const db = dbByName.get(name);

    if (db && indexMatches(db, desired)) continue;

    const unique = desired.unique ? "UNIQUE " : "";
    const concurrent = desired.concurrent ? "CONCURRENTLY " : "";
    const cols = desired.columns
      .map((c) => `${quoteIdentifier(c.name)} ${c.direction.toUpperCase()}`)
      .join(", ");

    let using = "";
    if (desired.method && desired.method !== "btree") {
      using = ` USING ${desired.method}`;
    }

    let stmt = `CREATE ${unique}INDEX ${concurrent}${quoteIdentifier(name)} ON ${q}${using} (${cols})`;

    if (desired.include && desired.include.length > 0) {
      const includeCols = desired.include.map((c) => quoteIdentifier(c)).join(", ");
      stmt += ` INCLUDE (${includeCols})`;
    }

    if (desired.where) {
      stmt += ` WHERE ${desired.where}`;
    }

    ops.push({
      type: "create_index",
      severity: "safe",
      schema,
      table,
      description: `Create index ${quoteIdentifier(name)} on ${q}`,
      sql: `${stmt};`,
      autocommit: desired.concurrent,
    });
  }

  return ops;
};
