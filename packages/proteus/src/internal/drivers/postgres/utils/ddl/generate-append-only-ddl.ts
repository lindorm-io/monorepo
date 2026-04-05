import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";

/**
 * Generates SQL trigger DDL to enforce append-only semantics at the database level.
 * When applied, UPDATE, DELETE, and TRUNCATE operations on the table will be rejected
 * by PostgreSQL triggers — even for raw SQL bypassing the ORM.
 *
 * The shared guard function is created once per schema (idempotent via CREATE OR REPLACE).
 * Per-table triggers use DROP IF EXISTS + CREATE to ensure idempotent re-application.
 */
export const generateAppendOnlyDDL = (
  tableName: string,
  namespace: string | null,
): Array<string> => {
  const schema = namespace ?? "public";
  const quotedSchema = quoteIdentifier(schema);
  const qualifiedTable = quoteQualifiedName(namespace, tableName);
  const qualifiedFunction = `${quotedSchema}."proteus_append_only_guard"`;

  const statements: Array<string> = [];

  // Shared guard function (idempotent — CREATE OR REPLACE)
  statements.push(
    [
      `CREATE OR REPLACE FUNCTION ${qualifiedFunction}()`,
      `RETURNS TRIGGER AS $$`,
      `BEGIN`,
      `  RAISE EXCEPTION 'append-only entity: % operations are forbidden on %.%',`,
      `    TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME`,
      `    USING ERRCODE = 'restrict_violation';`,
      `  RETURN NULL;`,
      `END;`,
      `$$ LANGUAGE plpgsql IMMUTABLE;`,
    ].join("\n"),
  );

  // Per-table triggers — DROP IF EXISTS + CREATE for idempotent re-creation
  for (const op of ["update", "delete"] as const) {
    const triggerName = `"proteus_append_only_no_${op}"`;
    statements.push(`DROP TRIGGER IF EXISTS ${triggerName} ON ${qualifiedTable};`);
    statements.push(
      [
        `CREATE TRIGGER ${triggerName}`,
        `  BEFORE ${op.toUpperCase()} ON ${qualifiedTable}`,
        `  FOR EACH ROW EXECUTE FUNCTION ${qualifiedFunction}();`,
      ].join("\n"),
    );
  }

  // TRUNCATE trigger (statement-level, no FOR EACH ROW)
  const truncateTrigger = `"proteus_append_only_no_truncate"`;
  statements.push(`DROP TRIGGER IF EXISTS ${truncateTrigger} ON ${qualifiedTable};`);
  statements.push(
    [
      `CREATE TRIGGER ${truncateTrigger}`,
      `  BEFORE TRUNCATE ON ${qualifiedTable}`,
      `  EXECUTE FUNCTION ${qualifiedFunction}();`,
    ].join("\n"),
  );

  return statements;
};
