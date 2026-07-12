import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { redactPgDetail } from "./redact-pg-detail.js";
import { describe, expect, test } from "vitest";

type FieldStub = { key: string; name: string; sensitive: { digest: null } | null };

const makeMetadata = (fields: Array<FieldStub>): EntityMetadata =>
  ({ fields }) as unknown as EntityMetadata;

const sensitiveMeta = makeMetadata([
  { key: "id", name: "id", sensitive: null },
  { key: "tokenHash", name: "token_hash", sensitive: { digest: null } },
  { key: "email", name: "email", sensitive: null },
]);

const plainMeta = makeMetadata([
  { key: "id", name: "id", sensitive: null },
  { key: "email", name: "email", sensitive: null },
]);

describe("redactPgDetail", () => {
  describe("Key (...)=(...) details (23505 / 23503)", () => {
    test("redacts the value portion when the named column is sensitive", () => {
      expect(
        redactPgDetail("Key (token_hash)=(hunter2) already exists.", sensitiveMeta),
      ).toBe("Key (token_hash)=([Filtered]) already exists.");
    });

    test("matches a pg-quoted column against the field key", () => {
      expect(
        redactPgDetail('Key ("tokenHash")=(hunter2) already exists.', sensitiveMeta),
      ).toBe('Key ("tokenHash")=([Filtered]) already exists.');
    });

    test("redacts a composite key when ANY named column is sensitive", () => {
      expect(
        redactPgDetail(
          "Key (email, token_hash)=(foo@bar.com, hunter2) already exists.",
          sensitiveMeta,
        ),
      ).toBe("Key (email, token_hash)=([Filtered]) already exists.");
    });

    test("preserves the FK-violation suffix (23503)", () => {
      expect(
        redactPgDetail(
          'Key (token_hash)=(hunter2) is not present in table "tokens".',
          sensitiveMeta,
        ),
      ).toBe('Key (token_hash)=([Filtered]) is not present in table "tokens".');
    });

    test("keeps a non-sensitive detail unchanged (behaviour preserved)", () => {
      const detail = "Key (email)=(foo@bar.com) already exists.";
      expect(redactPgDetail(detail, sensitiveMeta)).toBe(detail);
    });

    test("fails closed without metadata", () => {
      expect(redactPgDetail("Key (email)=(foo@bar.com) already exists.", undefined)).toBe(
        "Key (email)=([Filtered]) already exists.",
      );
    });
  });

  describe("Failing row contains details (23502 / 23514)", () => {
    test("redacts the whole row when the entity has any sensitive field", () => {
      expect(
        redactPgDetail("Failing row contains (1, hunter2, foo@bar.com).", sensitiveMeta),
      ).toBe("Failing row contains ([Filtered]).");
    });

    test("keeps the row when the entity has no sensitive fields", () => {
      const detail = "Failing row contains (1, foo@bar.com).";
      expect(redactPgDetail(detail, plainMeta)).toBe(detail);
    });

    test("fails closed without metadata", () => {
      expect(redactPgDetail("Failing row contains (1, foo@bar.com).", undefined)).toBe(
        "Failing row contains ([Filtered]).",
      );
    });
  });

  describe("non-value details", () => {
    test("keeps a value-free detail unchanged even without metadata", () => {
      const detail = "Process 12345 waits for ShareLock on transaction 67890.";
      expect(redactPgDetail(detail, undefined)).toBe(detail);
    });

    test("returns undefined for an undefined detail", () => {
      expect(redactPgDetail(undefined, sensitiveMeta)).toBeUndefined();
    });
  });
});
