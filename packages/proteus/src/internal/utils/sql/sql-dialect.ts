import type { LockMode } from "../../../types/find-options.js";
import type { MetaField } from "../../entity/types/metadata.js";

export type SqlDialect = {
  // Quoting
  quoteIdentifier: (name: string) => string;
  quoteQualifiedName: (schema: string | null, name: string) => string;

  // Parameters — call AFTER pushing to params array, returns "$N" or "?"
  placeholder: (params: Array<unknown>) => string;

  // Capabilities
  supportsReturning: boolean;
  supportsUpdateAlias: boolean;
  supportsDeleteAlias: boolean;
  supportsMaterializedCte: boolean;
  supportsNamespace: boolean;
  requiresLimitForOffset: boolean;

  // SQL expressions
  dateNowExpression: () => string;
  booleanLiteral: (value: boolean) => string;

  // Operator rendering — each returns a SQL fragment string
  compileIlike: (col: string, params: Array<unknown>, value: unknown) => string;
  compileRegex: (col: string, params: Array<unknown>, regex: RegExp) => string | null;
  compileSimilar: (col: string, params: Array<unknown>, value: unknown) => string;
  compileHas: (col: string, params: Array<unknown>, value: unknown) => string;
  compileAll: (
    col: string,
    params: Array<unknown>,
    arr: Array<unknown>,
    field: MetaField | null,
  ) => string;
  compileOverlap: (
    col: string,
    params: Array<unknown>,
    arr: Array<unknown>,
    field: MetaField | null,
  ) => string;
  compileContained: (
    col: string,
    params: Array<unknown>,
    arr: Array<unknown>,
    field: MetaField | null,
  ) => string;
  compileLength: (
    col: string,
    params: Array<unknown>,
    value: unknown,
    field: MetaField | null,
  ) => string;

  // Joined inheritance syntax
  joinedDeleteSyntax: "using" | "multi-table" | "subquery";
  joinedUpdateManySyntax: "from" | "multi-table" | "subquery";

  // Alias applied to single-row (PK-scoped) UPDATE statements, or null for an
  // unaliased UPDATE with unqualified column references. PG aliases as "t0";
  // MySQL and SQLite emit plain `UPDATE <table> SET ...`.
  singleRowUpdateAlias: string | null;

  // Upsert conflict handling — the clause emitted between `VALUES (...)` and
  // `RETURNING`. PG/SQLite: `ON CONFLICT (<cols>) DO UPDATE SET <set>`;
  // MySQL: `AS _new ON DUPLICATE KEY UPDATE <set>` (ignores the conflict target —
  // ON DUPLICATE KEY always resolves against the row's unique keys).
  buildUpsertConflictClause: (
    conflictColumns: Array<string>,
    setClauses: Array<string>,
  ) => string;
  // Reference to the incoming (proposed) row inside the conflict SET clause:
  // PG `EXCLUDED.<col>`, SQLite `excluded.<col>`, MySQL `` `_new`.<col> ``.
  upsertExcludedRef: (quotedColumn: string) => string;
  // NOW-expression for @UpdateDate in the conflict SET clause. Kept separate from
  // dateNowExpression() because the SQLite upsert spelling differs (space after
  // the comma) and is locked by snapshots.
  upsertDateNowExpression: () => string;

  // Raw param reindexing (PG-only — for $1/$2 renumbering in raw SQL fragments)
  reindexRawParams?: (
    expression: string,
    rawParams: Array<unknown>,
    params: Array<unknown>,
  ) => string;

  // Lock clause compilation — returns SQL string or throws for unsupported
  compileLockClause: (lock: LockMode | null) => string;

  // Composite PK expression for COUNT(DISTINCT ...) — ROW() vs CONCAT vs ||
  compileCompositePkExpression: (quotedColumns: Array<string>) => string;
};
