import { quoteIdentifier } from "../quote-identifier";

/**
 * Generates SQL trigger DDL to enforce append-only semantics at the database level.
 * When applied, UPDATE and DELETE operations on the table will be rejected
 * by MySQL triggers — even for raw SQL bypassing the ORM.
 *
 * MySQL does not support BEFORE TRUNCATE triggers, so TRUNCATE is not guarded.
 * Uses DROP TRIGGER IF EXISTS + CREATE TRIGGER for idempotent re-application.
 */
export const generateAppendOnlyDDL = (tableName: string): Array<string> => {
  const quotedTable = quoteIdentifier(tableName);
  const statements: Array<string> = [];

  for (const op of ["update", "delete"] as const) {
    const triggerName = quoteIdentifier(`proteus_ao_${tableName}_no_${op}`);

    statements.push(`DROP TRIGGER IF EXISTS ${triggerName};`);
    statements.push(
      [
        `CREATE TRIGGER ${triggerName}`,
        `  BEFORE ${op.toUpperCase()} ON ${quotedTable}`,
        `  FOR EACH ROW`,
        `  SIGNAL SQLSTATE '45000'`,
        `    SET MESSAGE_TEXT = 'append-only entity: ${op.toUpperCase()} operations are forbidden';`,
      ].join("\n"),
    );
  }

  return statements;
};
