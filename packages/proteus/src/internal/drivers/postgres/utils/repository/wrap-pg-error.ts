import { ProteusError } from "../../../../../errors/ProteusError.js";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError.js";
import { CheckConstraintError } from "../../../../errors/CheckConstraintError.js";
import { DeadlockError } from "../../../../errors/DeadlockError.js";
import { DuplicateKeyError } from "../../../../errors/DuplicateKeyError.js";
import { ForeignKeyViolationError } from "../../../../errors/ForeignKeyViolationError.js";
import { NotNullViolationError } from "../../../../errors/NotNullViolationError.js";
import { SerializationError } from "../../../../errors/SerializationError.js";

type PgError = Error & {
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  column?: string;
};

const isPgError = (error: unknown): error is PgError =>
  error instanceof Error && "code" in error;

export const wrapPgError = (
  error: unknown,
  message: string,
  context?: Record<string, unknown>,
): never => {
  if (error instanceof ProteusError) throw error;

  if (isPgError(error)) {
    switch (error.code) {
      case "23502":
        throw new NotNullViolationError(message, {
          code: "not_null_violation",
          error,
          data: { sqlState: error.code, column: error.column, table: error.table },
          debug: { ...context, detail: error.detail },
        });

      case "23503":
        throw new ForeignKeyViolationError(message, {
          code: "foreign_key_violation",
          error,
          data: {
            sqlState: error.code,
            constraint: error.constraint,
            table: error.table,
          },
          debug: { ...context, detail: error.detail },
        });

      case "23505":
        throw new DuplicateKeyError(message, {
          code: "unique_violation",
          error,
          data: { sqlState: error.code, constraint: error.constraint },
          debug: { ...context, detail: error.detail },
        });

      case "23514":
        throw new CheckConstraintError(message, {
          code: "check_constraint_violation",
          error,
          data: {
            sqlState: error.code,
            constraint: error.constraint,
            table: error.table,
          },
          debug: { ...context, detail: error.detail },
        });

      case "40001":
        throw new SerializationError(message, {
          code: "serialization_failure",
          error,
          data: { sqlState: error.code },
          debug: { ...context, detail: error.detail },
        });

      case "40P01":
        throw new DeadlockError(message, {
          code: "deadlock_detected",
          error,
          data: { sqlState: error.code },
          debug: { ...context, detail: error.detail },
        });
    }
  }

  throw new ProteusRepositoryError(message, {
    code: "query_execution_failed",
    error: error instanceof Error ? error : undefined,
    data: isPgError(error) ? { sqlState: error.code } : {},
    debug: {
      ...context,
      message: error instanceof Error ? error.message : String(error),
    },
  });
};
