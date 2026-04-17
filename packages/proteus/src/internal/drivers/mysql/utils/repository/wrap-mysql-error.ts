import { ProteusError } from "../../../../../errors/ProteusError";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError";
import { CheckConstraintError } from "../../../../errors/CheckConstraintError";
import { DeadlockError } from "../../../../errors/DeadlockError";
import { DuplicateKeyError } from "../../../../errors/DuplicateKeyError";
import { ForeignKeyViolationError } from "../../../../errors/ForeignKeyViolationError";
import { NotNullViolationError } from "../../../../errors/NotNullViolationError";
import { SerializationError } from "../../../../errors/SerializationError";

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
        code: errno,
        error,
        debug: { ...context, detail, code },
      });
    }

    // Foreign key violation — parent row referenced (cannot delete/update)
    if (errno === 1451 || errno === 1217) {
      throw new ForeignKeyViolationError(
        `${message} (foreign key violation: parent row referenced)`,
        {
          code: errno,
          error,
          debug: { ...context, detail, code },
        },
      );
    }

    // Foreign key violation — child row missing (cannot add/update)
    if (errno === 1452 || errno === 1216) {
      throw new ForeignKeyViolationError(
        `${message} (foreign key violation: referenced row not found)`,
        {
          code: errno,
          error,
          debug: { ...context, detail, code },
        },
      );
    }

    // NOT NULL violation
    if (errno === 1048 || errno === 1364) {
      throw new NotNullViolationError(`${message} (NOT NULL constraint violation)`, {
        code: errno,
        error,
        debug: { ...context, detail, code },
      });
    }

    // Deadlock
    if (errno === 1213) {
      throw new DeadlockError(`${message} (deadlock detected — retry the operation)`, {
        code: errno,
        error,
        debug: { ...context, detail, code },
      });
    }

    // Lock wait timeout
    if (errno === 1205) {
      throw new SerializationError(
        `${message} (lock wait timeout — retry the operation)`,
        {
          code: errno,
          error,
          debug: { ...context, detail, code },
        },
      );
    }

    // CHECK constraint violation (MySQL 8.0.16+)
    if (errno === 3819) {
      throw new CheckConstraintError(`${message} (CHECK constraint violation)`, {
        code: errno,
        error,
        debug: { ...context, detail, code },
      });
    }
  }

  // Fallback: unknown error shape
  throw new ProteusRepositoryError(message, {
    error: error instanceof Error ? error : undefined,
    debug: {
      ...context,
      message: error instanceof Error ? error.message : String(error),
    },
  });
};
