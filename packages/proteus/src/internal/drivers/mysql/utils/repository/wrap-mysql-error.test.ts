import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError";
import { CheckConstraintError } from "../../../../errors/CheckConstraintError";
import { DeadlockError } from "../../../../errors/DeadlockError";
import { DuplicateKeyError } from "../../../../errors/DuplicateKeyError";
import { ForeignKeyViolationError } from "../../../../errors/ForeignKeyViolationError";
import { NotNullViolationError } from "../../../../errors/NotNullViolationError";
import { SerializationError } from "../../../../errors/SerializationError";
import { wrapMysqlError } from "./wrap-mysql-error";
import { describe, expect, it } from "vitest";

const createMysqlError = (errno: number, code: string, message?: string): Error => {
  const error = new Error(message ?? `MySQL error ${code}`);
  (error as any).errno = errno;
  (error as any).code = code;
  (error as any).sqlMessage = message;
  return error;
};

describe("wrapMysqlError", () => {
  it("should rethrow ProteusError subclasses as-is", () => {
    const error = new DuplicateKeyError("already exists");
    expect(() => wrapMysqlError(error, "test")).toThrow(DuplicateKeyError);
  });

  it("should map errno 1062 (ER_DUP_ENTRY) to DuplicateKeyError", () => {
    const error = createMysqlError(
      1062,
      "ER_DUP_ENTRY",
      "Duplicate entry 'foo' for key 'PRIMARY'",
    );
    expect(() => wrapMysqlError(error, "insert failed")).toThrow(DuplicateKeyError);
  });

  it("should map errno 1586 to DuplicateKeyError", () => {
    const error = createMysqlError(1586, "ER_DUP_ENTRY_WITH_KEY_NAME", "Duplicate entry");
    expect(() => wrapMysqlError(error, "insert failed")).toThrow(DuplicateKeyError);
  });

  it("should map errno 1451 (FK parent referenced) to ForeignKeyViolationError", () => {
    const error = createMysqlError(
      1451,
      "ER_ROW_IS_REFERENCED_2",
      "Cannot delete parent row",
    );
    expect(() => wrapMysqlError(error, "delete failed")).toThrow(
      ForeignKeyViolationError,
    );
    try {
      wrapMysqlError(error, "delete failed");
    } catch (e) {
      expect(e).toBeInstanceOf(ForeignKeyViolationError);
      expect((e as Error).message).toMatchSnapshot();
    }
  });

  it("should map errno 1452 (FK child missing) to ForeignKeyViolationError", () => {
    const error = createMysqlError(
      1452,
      "ER_NO_REFERENCED_ROW_2",
      "Cannot add child row",
    );
    expect(() => wrapMysqlError(error, "insert failed")).toThrow(
      ForeignKeyViolationError,
    );
    try {
      wrapMysqlError(error, "insert failed");
    } catch (e) {
      expect(e).toBeInstanceOf(ForeignKeyViolationError);
    }
  });

  it("should map errno 1217 (ER_ROW_IS_REFERENCED) to ForeignKeyViolationError", () => {
    const error = createMysqlError(
      1217,
      "ER_ROW_IS_REFERENCED",
      "Cannot delete or update a parent row",
    );
    expect(() => wrapMysqlError(error, "delete failed")).toThrow(
      ForeignKeyViolationError,
    );
    try {
      wrapMysqlError(error, "delete failed");
    } catch (e) {
      expect(e).toBeInstanceOf(ForeignKeyViolationError);
      expect((e as Error).message).toMatchSnapshot();
    }
  });

  it("should map errno 1216 (ER_NO_REFERENCED_ROW) to ForeignKeyViolationError", () => {
    const error = createMysqlError(
      1216,
      "ER_NO_REFERENCED_ROW",
      "Cannot add or update a child row",
    );
    expect(() => wrapMysqlError(error, "insert failed")).toThrow(
      ForeignKeyViolationError,
    );
    try {
      wrapMysqlError(error, "insert failed");
    } catch (e) {
      expect(e).toBeInstanceOf(ForeignKeyViolationError);
      expect((e as Error).message).toMatchSnapshot();
    }
  });

  it("should map errno 1048 (NOT NULL) to NotNullViolationError", () => {
    const error = createMysqlError(
      1048,
      "ER_BAD_NULL_ERROR",
      "Column 'name' cannot be null",
    );
    expect(() => wrapMysqlError(error, "insert failed")).toThrow(NotNullViolationError);
    try {
      wrapMysqlError(error, "insert failed");
    } catch (e) {
      expect(e).toBeInstanceOf(NotNullViolationError);
      expect((e as Error).message).toMatchSnapshot();
    }
  });

  it("should map errno 1364 (NOT NULL no default) to NotNullViolationError", () => {
    const error = createMysqlError(
      1364,
      "ER_NO_DEFAULT_FOR_FIELD",
      "Field 'name' doesn't have a default value",
    );
    expect(() => wrapMysqlError(error, "insert failed")).toThrow(NotNullViolationError);
    try {
      wrapMysqlError(error, "insert failed");
    } catch (e) {
      expect(e).toBeInstanceOf(NotNullViolationError);
    }
  });

  it("should map errno 1213 (deadlock) to DeadlockError", () => {
    const error = createMysqlError(
      1213,
      "ER_LOCK_DEADLOCK",
      "Deadlock found when trying to get lock",
    );
    expect(() => wrapMysqlError(error, "update failed")).toThrow(DeadlockError);
    try {
      wrapMysqlError(error, "update failed");
    } catch (e) {
      expect(e).toBeInstanceOf(DeadlockError);
      expect((e as Error).message).toMatchSnapshot();
    }
  });

  it("should map errno 1205 (lock wait timeout) to SerializationError", () => {
    const error = createMysqlError(
      1205,
      "ER_LOCK_WAIT_TIMEOUT",
      "Lock wait timeout exceeded",
    );
    expect(() => wrapMysqlError(error, "update failed")).toThrow(SerializationError);
    try {
      wrapMysqlError(error, "update failed");
    } catch (e) {
      expect(e).toBeInstanceOf(SerializationError);
      expect((e as Error).message).toMatchSnapshot();
    }
  });

  it("should map errno 3819 (CHECK constraint) to CheckConstraintError", () => {
    const error = createMysqlError(
      3819,
      "ER_CHECK_CONSTRAINT_VIOLATED",
      "Check constraint violated",
    );
    expect(() => wrapMysqlError(error, "insert failed")).toThrow(CheckConstraintError);
    try {
      wrapMysqlError(error, "insert failed");
    } catch (e) {
      expect(e).toBeInstanceOf(CheckConstraintError);
      expect((e as Error).message).toMatchSnapshot();
    }
  });

  it("should wrap unknown Error as ProteusRepositoryError", () => {
    const error = new Error("Something unexpected");
    expect(() => wrapMysqlError(error, "operation failed")).toThrow(
      ProteusRepositoryError,
    );
  });

  it("should wrap non-Error values as ProteusRepositoryError", () => {
    expect(() => wrapMysqlError("string error", "operation failed")).toThrow(
      ProteusRepositoryError,
    );
  });
});
