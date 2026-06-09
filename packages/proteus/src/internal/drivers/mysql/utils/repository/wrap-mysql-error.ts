import { ProteusError } from "../../../../../errors/ProteusError.js";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError.js";
import { CheckConstraintError } from "../../../../errors/CheckConstraintError.js";
import { DeadlockError } from "../../../../errors/DeadlockError.js";
import { DuplicateKeyError } from "../../../../errors/DuplicateKeyError.js";
import { ForeignKeyViolationError } from "../../../../errors/ForeignKeyViolationError.js";
import { NotNullViolationError } from "../../../../errors/NotNullViolationError.js";
import { SerializationError } from "../../../../errors/SerializationError.js";

/**
 * Maps mysql2 error codes to Proteus error classes and throws.
 *
 * mysql2 errors have `errno` (number) and `code` (string) properties
 * on the Error object.
 */
export const wrapMysqlError = (
  error: unknown,
  message: string,
  context?: Record<string, unknown>,
): never => {
  // Already a Proteus error — rethrow as-is
  if (error instanceof ProteusError) throw error;

  if (error instanceof Error) {
    const errno = (error as any).errno as number | undefined;
    const code = (error as any).code as string | undefined;
    const sqlMessage = (error as any).sqlMessage as string | undefined;
    const detail = sqlMessage ?? error.message;

    // Duplicate key (ER_DUP_ENTRY, ER_DUP_ENTRY_WITH_KEY_NAME)
    if (errno === 1062 || errno === 1586) {
      throw new DuplicateKeyError(message, {
        code: "unique_violation",
        title: "Unique Violation",
        details: "A unique constraint or primary key was violated by the affected row.",
        error,
        debug: { ...context, detail, errno, sqlState: code },
      });
    }

    // Foreign key violation — parent row referenced (cannot delete/update)
    if (errno === 1451 || errno === 1217) {
      throw new ForeignKeyViolationError(
        `${message} (foreign key violation: parent row referenced)`,
        {
          code: "foreign_key_violation",
          title: "Foreign Key Violation",
          details:
            "A parent row is still referenced by a child row, so it cannot be deleted or updated.",
          error,
          debug: { ...context, detail, errno, sqlState: code },
        },
      );
    }

    // Foreign key violation — child row missing (cannot add/update)
    if (errno === 1452 || errno === 1216) {
      throw new ForeignKeyViolationError(
        `${message} (foreign key violation: referenced row not found)`,
        {
          code: "foreign_key_violation",
          title: "Foreign Key Violation",
          details:
            "The inserted or updated row references a parent row that does not exist.",
          error,
          debug: { ...context, detail, errno, sqlState: code },
        },
      );
    }

    // NOT NULL violation
    if (errno === 1048 || errno === 1364) {
      throw new NotNullViolationError(`${message} (NOT NULL constraint violation)`, {
        code: "not_null_violation",
        title: "Not Null Violation",
        details: "A NOT NULL column received a null value during insert or update.",
        error,
        debug: { ...context, detail, errno, sqlState: code },
      });
    }

    // Deadlock
    if (errno === 1213) {
      throw new DeadlockError(`${message} (deadlock detected — retry the operation)`, {
        code: "deadlock_detected",
        title: "Deadlock Detected",
        details:
          "The transaction was rolled back because a deadlock was detected; retry the operation.",
        error,
        debug: { ...context, detail, errno, sqlState: code },
      });
    }

    // Lock wait timeout
    if (errno === 1205) {
      throw new SerializationError(
        `${message} (lock wait timeout — retry the operation)`,
        {
          code: "serialization_failure",
          title: "Serialization Failure",
          details:
            "A lock wait timeout was exceeded while acquiring a row lock; retry the operation.",
          error,
          debug: { ...context, detail, errno, sqlState: code },
        },
      );
    }

    // CHECK constraint violation (MySQL 8.0.16+)
    if (errno === 3819) {
      throw new CheckConstraintError(`${message} (CHECK constraint violation)`, {
        code: "check_constraint_violation",
        title: "Check Constraint Violation",
        details: "The affected row failed a CHECK constraint defined on the table.",
        error,
        debug: { ...context, detail, errno, sqlState: code },
      });
    }
  }

  // Fallback: unknown error shape
  throw new ProteusRepositoryError(message, {
    code: "query_execution_failed",
    title: "Query Execution Failed",
    details:
      "The MySQL query failed with an error that does not map to a known constraint condition.",
    error: error instanceof Error ? error : undefined,
    debug: {
      ...context,
      message: error instanceof Error ? error.message : String(error),
    },
  });
};
