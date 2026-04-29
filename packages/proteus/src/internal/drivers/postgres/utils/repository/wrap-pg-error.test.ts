import { ProteusError } from "../../../../../errors/ProteusError.js";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError.js";
import { CheckConstraintError } from "../../../../errors/CheckConstraintError.js";
import { DeadlockError } from "../../../../errors/DeadlockError.js";
import { DuplicateKeyError } from "../../../../errors/DuplicateKeyError.js";
import { ForeignKeyViolationError } from "../../../../errors/ForeignKeyViolationError.js";
import { NotNullViolationError } from "../../../../errors/NotNullViolationError.js";
import { OptimisticLockError } from "../../../../errors/OptimisticLockError.js";
import { SerializationError } from "../../../../errors/SerializationError.js";
import { PostgresExecutorError } from "../../errors/PostgresExecutorError.js";
import { wrapPgError } from "./wrap-pg-error.js";
import { describe, expect, test } from "vitest";

type PgErrorFields = {
  detail?: string;
  column?: string;
  table?: string;
  constraint?: string;
};

const makePgError = (
  code: string,
  fields: PgErrorFields = {},
): Error & { code: string } & PgErrorFields => {
  const error = new Error("PG error") as Error & { code: string } & PgErrorFields;
  error.code = code;
  if (fields.detail !== undefined) error.detail = fields.detail;
  if (fields.column !== undefined) error.column = fields.column;
  if (fields.table !== undefined) error.table = fields.table;
  if (fields.constraint !== undefined) error.constraint = fields.constraint;
  return error;
};

describe("wrapPgError", () => {
  describe("ProteusError passthrough", () => {
    test("re-throws ProteusError instances unchanged", () => {
      const original = new ProteusError("original proteus error");
      expect(() => wrapPgError(original, "should not matter")).toThrow(original);
    });

    test("re-throws ProteusRepositoryError unchanged (subclass of ProteusError)", () => {
      const original = new ProteusRepositoryError("original repo error");
      expect(() => wrapPgError(original, "should not matter")).toThrow(original);
    });

    test("re-throws DuplicateKeyError unchanged (subclass of ProteusError)", () => {
      const original = new DuplicateKeyError("original dup key error");
      expect(() => wrapPgError(original, "should not matter")).toThrow(original);
    });
  });

  describe("PG error code 23502 — NOT NULL violation", () => {
    test("maps PG code 23502 to NotNullViolationError", () => {
      const pgError = makePgError("23502");
      expect(() => wrapPgError(pgError, "not null violation")).toThrow(
        NotNullViolationError,
      );
    });

    test("NotNullViolationError includes the provided message", () => {
      const pgError = makePgError("23502");
      expect(() => wrapPgError(pgError, "insert failed: not null")).toThrow(
        "insert failed: not null",
      );
    });

    test("NotNullViolationError debug includes detail, column, table, and context fields", () => {
      const pgError = makePgError("23502", {
        detail: "Failing row contains (null, foo@bar.com).",
        column: "email",
        table: "users",
      });
      let thrown: NotNullViolationError | undefined;
      try {
        wrapPgError(pgError, "not null violation", {
          operation: "insert",
          entity: "User",
        });
      } catch (e) {
        thrown = e as NotNullViolationError;
      }
      expect(thrown).toBeInstanceOf(NotNullViolationError);
      expect(thrown?.debug).toMatchSnapshot();
    });
  });

  describe("PG error code 23503 — FK violation", () => {
    test("maps PG code 23503 to ForeignKeyViolationError", () => {
      const pgError = makePgError("23503");
      expect(() => wrapPgError(pgError, "fk violation")).toThrow(
        ForeignKeyViolationError,
      );
    });

    test("ForeignKeyViolationError includes the provided message", () => {
      const pgError = makePgError("23503");
      expect(() => wrapPgError(pgError, "insert failed: fk constraint")).toThrow(
        "insert failed: fk constraint",
      );
    });

    test("ForeignKeyViolationError debug includes detail, constraint, table, and context fields", () => {
      const pgError = makePgError("23503", {
        detail: 'Key (user_id)=(999) is not present in table "users".',
        constraint: "orders_user_id_fkey",
        table: "orders",
      });
      let thrown: ForeignKeyViolationError | undefined;
      try {
        wrapPgError(pgError, "fk violation", { operation: "insert", entity: "Order" });
      } catch (e) {
        thrown = e as ForeignKeyViolationError;
      }
      expect(thrown).toBeInstanceOf(ForeignKeyViolationError);
      expect(thrown?.debug).toMatchSnapshot();
    });
  });

  describe("PG error code 23505 — unique constraint violation", () => {
    test("maps PG code 23505 to DuplicateKeyError", () => {
      const pgError = makePgError("23505");
      expect(() => wrapPgError(pgError, "duplicate key")).toThrow(DuplicateKeyError);
    });

    test("DuplicateKeyError includes the provided message", () => {
      const pgError = makePgError("23505");
      expect(() => wrapPgError(pgError, "insert failed: duplicate")).toThrow(
        "insert failed: duplicate",
      );
    });

    test("DuplicateKeyError debug includes pg detail when present", () => {
      const pgError = makePgError("23505", {
        detail: "Key (email)=(foo@bar.com) already exists.",
      });
      let thrown: DuplicateKeyError | undefined;
      try {
        wrapPgError(pgError, "duplicate", { table: "users" });
      } catch (e) {
        thrown = e as DuplicateKeyError;
      }
      expect(thrown).toBeInstanceOf(DuplicateKeyError);
      expect(thrown?.debug).toMatchSnapshot();
    });

    test("DuplicateKeyError debug includes context fields", () => {
      const pgError = makePgError("23505", { detail: "Key (id)=(1) already exists." });
      let thrown: DuplicateKeyError | undefined;
      try {
        wrapPgError(pgError, "duplicate", { operation: "insert", entity: "Order" });
      } catch (e) {
        thrown = e as DuplicateKeyError;
      }
      expect(thrown?.debug).toMatchSnapshot();
    });

    test("DuplicateKeyError debug forwards constraint field when present", () => {
      const pgError = makePgError("23505", {
        detail: "Key (email)=(foo@bar.com) already exists.",
        constraint: "users_email_key",
      });
      let thrown: DuplicateKeyError | undefined;
      try {
        wrapPgError(pgError, "duplicate", { table: "users" });
      } catch (e) {
        thrown = e as DuplicateKeyError;
      }
      expect(thrown).toBeInstanceOf(DuplicateKeyError);
      expect(thrown?.debug).toMatchSnapshot();
    });
  });

  describe("PG error code 23514 — CHECK constraint violation", () => {
    test("maps PG code 23514 to CheckConstraintError", () => {
      const pgError = makePgError("23514");
      expect(() => wrapPgError(pgError, "check constraint violation")).toThrow(
        CheckConstraintError,
      );
    });

    test("CheckConstraintError includes the provided message", () => {
      const pgError = makePgError("23514");
      expect(() => wrapPgError(pgError, "insert failed: check constraint")).toThrow(
        "insert failed: check constraint",
      );
    });

    test("CheckConstraintError debug includes detail, constraint, table, and context fields", () => {
      const pgError = makePgError("23514", {
        detail: "Failing row contains (age=-1).",
        constraint: "users_age_check",
        table: "users",
      });
      let thrown: CheckConstraintError | undefined;
      try {
        wrapPgError(pgError, "check constraint violation", {
          operation: "update",
          entity: "User",
        });
      } catch (e) {
        thrown = e as CheckConstraintError;
      }
      expect(thrown).toBeInstanceOf(CheckConstraintError);
      expect(thrown?.debug).toMatchSnapshot();
    });
  });

  describe("PG error code 40001 — Serialization failure", () => {
    test("maps PG code 40001 to SerializationError", () => {
      const pgError = makePgError("40001");
      expect(() => wrapPgError(pgError, "serialization failure")).toThrow(
        SerializationError,
      );
    });

    test("SerializationError includes the provided message", () => {
      const pgError = makePgError("40001");
      expect(() => wrapPgError(pgError, "transaction failed: serialization")).toThrow(
        "transaction failed: serialization",
      );
    });

    test("SerializationError debug includes detail and context fields", () => {
      const pgError = makePgError("40001", {
        detail: "Process 12345 waits for ShareLock on transaction 67890.",
      });
      let thrown: SerializationError | undefined;
      try {
        wrapPgError(pgError, "serialization failure", {
          operation: "update",
          entity: "Account",
        });
      } catch (e) {
        thrown = e as SerializationError;
      }
      expect(thrown).toBeInstanceOf(SerializationError);
      expect(thrown?.debug).toMatchSnapshot();
    });
  });

  describe("PG error code 40P01 — Deadlock detected", () => {
    test("maps PG code 40P01 to DeadlockError", () => {
      const pgError = makePgError("40P01");
      expect(() => wrapPgError(pgError, "deadlock detected")).toThrow(DeadlockError);
    });

    test("DeadlockError includes the provided message", () => {
      const pgError = makePgError("40P01");
      expect(() => wrapPgError(pgError, "transaction failed: deadlock")).toThrow(
        "transaction failed: deadlock",
      );
    });

    test("DeadlockError debug includes detail and context fields", () => {
      const pgError = makePgError("40P01", {
        detail: "Process 12345 waits for ShareLock on transaction 67890.",
      });
      let thrown: DeadlockError | undefined;
      try {
        wrapPgError(pgError, "deadlock detected", {
          operation: "update",
          entity: "Account",
        });
      } catch (e) {
        thrown = e as DeadlockError;
      }
      expect(thrown).toBeInstanceOf(DeadlockError);
      expect(thrown?.debug).toMatchSnapshot();
    });
  });

  describe("error hierarchy", () => {
    test("PostgresExecutorError is an instanceof ProteusRepositoryError", () => {
      const error = new PostgresExecutorError("executor error");
      expect(error).toBeInstanceOf(ProteusRepositoryError);
    });

    test("PostgresExecutorError is an instanceof ProteusError", () => {
      const error = new PostgresExecutorError("executor error");
      expect(error).toBeInstanceOf(ProteusError);
    });

    test("OptimisticLockError is an instanceof ProteusRepositoryError", () => {
      const error = new OptimisticLockError("MyEntity", { id: "123" });
      expect(error).toBeInstanceOf(ProteusRepositoryError);
    });

    test("OptimisticLockError is an instanceof ProteusError", () => {
      const error = new OptimisticLockError("MyEntity", { id: "123" });
      expect(error).toBeInstanceOf(ProteusError);
    });

    test("DuplicateKeyError is an instanceof ProteusRepositoryError", () => {
      const error = new DuplicateKeyError("duplicate key error");
      expect(error).toBeInstanceOf(ProteusRepositoryError);
    });

    test("DuplicateKeyError is an instanceof ProteusError", () => {
      const error = new DuplicateKeyError("duplicate key error");
      expect(error).toBeInstanceOf(ProteusError);
    });
  });

  describe("unknown errors — wrapping in ProteusRepositoryError", () => {
    test("wraps standard Error in ProteusRepositoryError", () => {
      const error = new Error("connection timeout");
      expect(() => wrapPgError(error, "query failed")).toThrow(ProteusRepositoryError);
    });

    test("wraps PG error with non-23505 code in ProteusRepositoryError", () => {
      const pgError = makePgError("42P01"); // undefined table
      expect(() => wrapPgError(pgError, "query failed")).toThrow(ProteusRepositoryError);
    });

    test("wraps non-Error value (string) in ProteusRepositoryError", () => {
      expect(() => wrapPgError("something went wrong", "query failed")).toThrow(
        ProteusRepositoryError,
      );
    });

    test("ProteusRepositoryError includes provided message", () => {
      const error = new Error("timeout");
      expect(() => wrapPgError(error, "update failed")).toThrow("update failed");
    });

    test("ProteusRepositoryError debug includes original error message", () => {
      const error = new Error("connection refused");
      let thrown: ProteusRepositoryError | undefined;
      try {
        wrapPgError(error, "query failed", { table: "orders" });
      } catch (e) {
        thrown = e as ProteusRepositoryError;
      }
      expect(thrown).toBeInstanceOf(ProteusRepositoryError);
      expect(thrown?.debug).toMatchSnapshot();
    });

    test("ProteusRepositoryError debug includes pg error code when available", () => {
      const pgError = makePgError("42703"); // undefined column
      let thrown: ProteusRepositoryError | undefined;
      try {
        wrapPgError(pgError, "query failed", { table: "orders" });
      } catch (e) {
        thrown = e as ProteusRepositoryError;
      }
      expect(thrown?.debug).toMatchSnapshot();
    });

    test("ProteusRepositoryError debug includes context fields", () => {
      const error = new Error("unexpected");
      let thrown: ProteusRepositoryError | undefined;
      try {
        wrapPgError(error, "failed", { entity: "User", operation: "find" });
      } catch (e) {
        thrown = e as ProteusRepositoryError;
      }
      expect(thrown?.debug).toMatchSnapshot();
    });

    test("ProteusRepositoryError debug code is undefined for non-PG errors", () => {
      const error = new Error("plain js error");
      let thrown: ProteusRepositoryError | undefined;
      try {
        wrapPgError(error, "query failed");
      } catch (e) {
        thrown = e as ProteusRepositoryError;
      }
      expect(thrown?.debug).toMatchSnapshot();
    });

    test("ProteusRepositoryError debug uses String() for non-Error values", () => {
      let thrown: ProteusRepositoryError | undefined;
      try {
        wrapPgError(42, "query failed");
      } catch (e) {
        thrown = e as ProteusRepositoryError;
      }
      expect(thrown?.debug).toMatchSnapshot();
    });
  });
});
