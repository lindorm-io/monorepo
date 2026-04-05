import { quoteIdentifier } from "../quote-identifier";

/**
 * Generates SQL trigger DDL to enforce append-only semantics at the database level.
 * When applied, UPDATE and DELETE operations on the table will be rejected
 * by SQLite triggers — even for raw SQL bypassing the ORM.
 *
 * SQLite does not support BEFORE TRUNCATE triggers, so TRUNCATE is not guarded.
 * Uses CREATE TRIGGER IF NOT EXISTS for idempotent creation.
 */
export const generateAppendOnlyDDL = (tableName: string): Array<string> => {
  const quotedTable = quoteIdentifier(tableName);
  const statements: Array<string> = [];

  for (const op of ["update", "delete"] as const) {
    statements.push(
      [
        `CREATE TRIGGER IF NOT EXISTS ${quoteIdentifier(`proteus_ao_${tableName}_no_${op}`)}`,
        `  BEFORE ${op.toUpperCase()} ON ${quotedTable}`,
        `  FOR EACH ROW`,
        `  BEGIN`,
        `    SELECT RAISE(ABORT, 'append-only entity: ${op.toUpperCase()} operations are forbidden');`,
        `  END;`,
      ].join("\n"),
    );
  }

  return statements;
};
