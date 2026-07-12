import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { redactMysqlDuplicateEntry } from "./redact-mysql-duplicate.js";
import { describe, expect, test } from "vitest";

type MetadataStub = {
  fields?: Array<{ key: string; name: string; sensitive: { digest: null } | null }>;
  uniques?: Array<{ keys: Array<string>; name: string | null }>;
  indexes?: Array<{ keys: Array<{ key: string }>; name: string | null; unique: boolean }>;
  primaryKeys?: Array<string>;
};

const makeMetadata = (stub: MetadataStub): EntityMetadata =>
  ({
    fields: stub.fields ?? [],
    uniques: stub.uniques ?? [],
    indexes: stub.indexes ?? [],
    primaryKeys: stub.primaryKeys ?? [],
  }) as unknown as EntityMetadata;

const makeMysqlError = (sqlMessage: string): Error => {
  const error = new Error(sqlMessage);
  (error as any).errno = 1062;
  (error as any).code = "ER_DUP_ENTRY";
  (error as any).sqlMessage = sqlMessage;
  return error;
};

const SENSITIVE_UNIQUE = makeMetadata({
  fields: [
    { key: "id", name: "id", sensitive: null },
    { key: "tokenHash", name: "token_hash", sensitive: { digest: null } },
  ],
  uniques: [{ keys: ["tokenHash"], name: "uq_token" }],
});

describe("redactMysqlDuplicateEntry", () => {
  test("redacts when the key name resolves to a sensitive @Unique column", () => {
    const detail = "Duplicate entry 'hunter2' for key 'tokens.uq_token'";
    const error = makeMysqlError(detail);

    const result = redactMysqlDuplicateEntry(error, detail, SENSITIVE_UNIQUE);

    expect(result.detail).toBe("Duplicate entry '[Filtered]' for key 'tokens.uq_token'");
    expect(result.error).not.toBe(error);
    expect(result.error.message).not.toContain("hunter2");
    expect(result.error.message).toContain("[Filtered]");
    expect(result.error.stack).not.toContain("hunter2");
    expect(result.error.name).toBe(error.name);
  });

  test("redacts when PRIMARY resolves to a sensitive primary key", () => {
    const metadata = makeMetadata({
      fields: [{ key: "id", name: "id", sensitive: { digest: null } }],
      primaryKeys: ["id"],
    });
    const detail = "Duplicate entry 'secret-pk' for key 'PRIMARY'";
    const error = makeMysqlError(detail);

    const result = redactMysqlDuplicateEntry(error, detail, metadata);

    expect(result.detail).toBe("Duplicate entry '[Filtered]' for key 'PRIMARY'");
    expect(result.error.message).not.toContain("secret-pk");
  });

  test("redacts when the key name resolves to a sensitive unique @Index", () => {
    const metadata = makeMetadata({
      fields: [{ key: "tokenHash", name: "token_hash", sensitive: { digest: null } }],
      indexes: [{ keys: [{ key: "tokenHash" }], name: "idx_token", unique: true }],
    });
    const detail = "Duplicate entry 'hunter2' for key 'tokens.idx_token'";
    const error = makeMysqlError(detail);

    const result = redactMysqlDuplicateEntry(error, detail, metadata);

    expect(result.detail).toBe("Duplicate entry '[Filtered]' for key 'tokens.idx_token'");
  });

  test("keeps a resolvable non-sensitive key unchanged (behaviour preserved)", () => {
    const metadata = makeMetadata({
      fields: [{ key: "email", name: "email", sensitive: null }],
      uniques: [{ keys: ["email"], name: "uq_email" }],
    });
    const detail = "Duplicate entry 'foo@bar.com' for key 'users.uq_email'";
    const error = makeMysqlError(detail);

    const result = redactMysqlDuplicateEntry(error, detail, metadata);

    expect(result.detail).toBe(detail);
    expect(result.error).toBe(error);
  });

  test("falls back to redacting an unresolvable key when the entity has a sensitive field", () => {
    const detail = "Duplicate entry 'hunter2' for key 'tokens.some_ddl_name'";
    const error = makeMysqlError(detail);

    const result = redactMysqlDuplicateEntry(error, detail, SENSITIVE_UNIQUE);

    expect(result.detail).toBe(
      "Duplicate entry '[Filtered]' for key 'tokens.some_ddl_name'",
    );
  });

  test("keeps an unresolvable key unchanged when the entity has no sensitive fields", () => {
    const metadata = makeMetadata({
      fields: [{ key: "email", name: "email", sensitive: null }],
    });
    const detail = "Duplicate entry 'foo@bar.com' for key 'users.some_ddl_name'";
    const error = makeMysqlError(detail);

    const result = redactMysqlDuplicateEntry(error, detail, metadata);

    expect(result.detail).toBe(detail);
    expect(result.error).toBe(error);
  });

  test("fails closed without metadata", () => {
    const detail = "Duplicate entry 'foo@bar.com' for key 'users.uq_email'";
    const error = makeMysqlError(detail);

    const result = redactMysqlDuplicateEntry(error, detail, undefined);

    expect(result.detail).toBe("Duplicate entry '[Filtered]' for key 'users.uq_email'");
    expect(result.error.message).not.toContain("foo@bar.com");
  });

  test("keeps a non-ER_DUP_ENTRY message unchanged", () => {
    const detail = "Cannot add or update a child row";
    const error = makeMysqlError(detail);

    const result = redactMysqlDuplicateEntry(error, detail, undefined);

    expect(result.detail).toBe(detail);
    expect(result.error).toBe(error);
  });

  test("returns undefined detail untouched", () => {
    const error = makeMysqlError("whatever");
    const result = redactMysqlDuplicateEntry(error, undefined, SENSITIVE_UNIQUE);

    expect(result.detail).toBeUndefined();
    expect(result.error).toBe(error);
  });
});
