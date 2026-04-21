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
    const code = (error as any).code as string | undefined;

    if (msg.includes("UNIQUE constraint failed")) {
      throw new DuplicateKeyError(message, {
        code,
        error,
        debug: { ...context, detail: msg },
      });
    }

    if (msg.includes("FOREIGN KEY constraint failed")) {
      throw new ForeignKeyViolationError(message, {
        code,
        error,
        debug: { ...context, detail: msg },
      });
    }

    if (msg.includes("NOT NULL constraint failed")) {
      throw new NotNullViolationError(message, {
        code,
        error,
        debug: { ...context, detail: msg },
      });
    }

    if (msg.includes("CHECK constraint failed")) {
      throw new CheckConstraintError(message, {
        code,
        error,
        debug: { ...context, detail: msg },
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
          error,
          debug: { ...context, detail: msg },
        },
      );
    }
  }

  throw new ProteusRepositoryError(message, {
    error: error instanceof Error ? error : undefined,
    debug: {
      ...context,
      message: error instanceof Error ? error.message : String(error),
    },
  });
};
