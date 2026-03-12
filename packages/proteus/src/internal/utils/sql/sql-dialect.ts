import type { LockMode } from "../../../types/find-options";
import type { MetaField } from "#internal/entity/types/metadata";

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
  compileLength: (col: string, params: Array<unknown>, value: unknown) => string;

  // Joined inheritance syntax
  joinedDeleteSyntax: "using" | "multi-table" | "subquery";
  joinedUpdateManySyntax: "from" | "multi-table" | "subquery";

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
