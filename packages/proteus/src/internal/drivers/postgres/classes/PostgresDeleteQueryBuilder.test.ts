import { ProteusError } from "../../../../errors";
import { makeField } from "../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../entity/types/metadata";
import { PostgresDeleteQueryBuilder } from "./PostgresDeleteQueryBuilder";
import { beforeEach, describe, expect, test, vi } from "vitest";

const metadata = {
  entity: { name: "users", namespace: null },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("deletedAt", {
      type: "timestamp",
      decorator: "DeleteDate",
      name: "deleted_at",
    }),
  ],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const metadataWithoutDeleteDate = {
  entity: { name: "products", namespace: null },
  fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const mockClient = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };

describe("PostgresDeleteQueryBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should throw when execute is called without where", async () => {
    const builder = new PostgresDeleteQueryBuilder(metadata, mockClient as any);
    await expect(builder.execute()).rejects.toThrow(
      'DELETE on "users" requires at least one .where() predicate',
    );
  });

  test("should execute when where is provided", async () => {
    const builder = new PostgresDeleteQueryBuilder(metadata, mockClient as any);
    builder.where({ id: "abc" } as any);
    await builder.execute();
    expect(mockClient.query).toHaveBeenCalledTimes(1);
  });

  test("should throw for soft delete without where", async () => {
    const builder = new PostgresDeleteQueryBuilder(
      metadata,
      mockClient as any,
      null,
      true,
    );
    await expect(builder.execute()).rejects.toThrow(
      'DELETE on "users" requires at least one .where() predicate',
    );
  });

  describe("ProteusError type assertions", () => {
    test("execute() with no predicates throws ProteusError (not bare Error)", async () => {
      const builder = new PostgresDeleteQueryBuilder(metadata, mockClient as any);
      const error = await builder.execute().catch((e) => e);
      expect(error).toBeInstanceOf(ProteusError);
    });

    test("softDelete().execute() on entity without @DeleteDate throws ProteusError", async () => {
      const builder = new PostgresDeleteQueryBuilder(
        metadataWithoutDeleteDate,
        mockClient as any,
        null,
        true,
      );
      builder.where({ id: "abc" } as any);
      const error = await builder.execute().catch((e) => e);
      expect(error).toBeInstanceOf(ProteusError);
      expect((error as ProteusError).message).toContain(
        'Entity "products" has no @DeleteDateField — cannot use softDelete()',
      );
    });
  });
});
