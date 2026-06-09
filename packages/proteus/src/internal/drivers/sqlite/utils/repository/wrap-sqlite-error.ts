import { ProteusError } from "../../../../../errors/ProteusError.js";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError.js";
import { CheckConstraintError } from "../../../../errors/CheckConstraintError.js";
import { DuplicateKeyError } from "../../../../errors/DuplicateKeyError.js";
import { ForeignKeyViolationError } from "../../../../errors/ForeignKeyViolationError.js";
import { NotNullViolationError } from "../../../../errors/NotNullViolationError.js";

export const wrapSqliteError = (
  error: unknown,
  message: string,
  context?: Record<string, unknown>,
): never => {
  if (error instanceof ProteusError) throw error;

  if (error instanceof Error) {
    const msg = error.message;
    const sqliteCode = (error as any).code as string | undefined;

    if (msg.includes("UNIQUE constraint failed")) {
      throw new DuplicateKeyError(message, {
        code: "unique_violation",
        title: "Unique Violation",
        details: "A unique constraint was violated by the attempted write.",
        error,
        debug: { ...context, detail: msg, sqliteCode },
      });
    }

    if (msg.includes("FOREIGN KEY constraint failed")) {
      throw new ForeignKeyViolationError(message, {
        code: "foreign_key_violation",
        title: "Foreign Key Violation",
        details: "A foreign key constraint was violated by the attempted write.",
        error,
        debug: { ...context, detail: msg, sqliteCode },
      });
    }

    if (msg.includes("NOT NULL constraint failed")) {
      throw new NotNullViolationError(message, {
        code: "not_null_violation",
        title: "Not Null Violation",
        details: "A NOT NULL column received a null value during the write.",
        error,
        debug: { ...context, detail: msg, sqliteCode },
      });
    }

    if (msg.includes("CHECK constraint failed")) {
      throw new CheckConstraintError(message, {
        code: "check_constraint_violation",
        title: "Check Constraint Violation",
        details: "A CHECK constraint rejected the value in the attempted write.",
        error,
        debug: { ...context, detail: msg, sqliteCode },
      });
    }

    if (
      msg.includes("SQLITE_BUSY") ||
      msg.includes("SQLITE_LOCKED") ||
      msg.includes("database is locked") ||
      msg.includes("database table is locked")
    ) {
      throw new ProteusRepositoryError(
        `${message} (database locked — retry the operation)`,
        {
          code: "serialization_failure",
          title: "Serialization Failure",
          details:
            "The database was locked by a concurrent transaction; retry the operation.",
          error,
          debug: { ...context, detail: msg, sqliteCode },
        },
      );
    }
  }

  throw new ProteusRepositoryError(message, {
    code: "query_execution_failed",
    title: "Query Execution Failed",
    details: "The SQLite driver raised an unclassified error while executing the query.",
    error: error instanceof Error ? error : undefined,
    debug: {
      ...context,
      message: error instanceof Error ? error.message : String(error),
    },
  });
};
