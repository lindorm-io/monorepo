import { ProteusError } from "../../../../../errors/ProteusError";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError";
import { CheckConstraintError } from "#internal/errors/CheckConstraintError";
import { DeadlockError } from "#internal/errors/DeadlockError";
import { DuplicateKeyError } from "#internal/errors/DuplicateKeyError";
import { ForeignKeyViolationError } from "#internal/errors/ForeignKeyViolationError";
import { NotNullViolationError } from "#internal/errors/NotNullViolationError";
import { SerializationError } from "#internal/errors/SerializationError";

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
          code: error.code,
          error,
          debug: {
            ...context,
            detail: error.detail,
            column: error.column,
            table: error.table,
          },
        });

      case "23503":
        throw new ForeignKeyViolationError(message, {
          code: error.code,
          error,
          debug: {
            ...context,
            detail: error.detail,
            constraint: error.constraint,
            table: error.table,
          },
        });

      case "23505":
        throw new DuplicateKeyError(message, {
          code: error.code,
          error,
          debug: { ...context, detail: error.detail, constraint: error.constraint },
        });

      case "23514":
        throw new CheckConstraintError(message, {
          code: error.code,
          error,
          debug: {
            ...context,
            detail: error.detail,
            constraint: error.constraint,
            table: error.table,
          },
        });

      case "40001":
        throw new SerializationError(message, {
          code: error.code,
          error,
          debug: { ...context, detail: error.detail },
        });

      case "40P01":
        throw new DeadlockError(message, {
          code: error.code,
          error,
          debug: { ...context, detail: error.detail },
        });
    }
  }

  throw new ProteusRepositoryError(message, {
    error: error instanceof Error ? error : undefined,
    debug: {
      ...context,
      code: isPgError(error) ? error.code : undefined,
      message: error instanceof Error ? error.message : String(error),
    },
  });
};
