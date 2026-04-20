import { makeField } from "../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../entity/types/metadata";
import { ProteusError } from "../../../../errors/ProteusError";
import { PostgresInsertQueryBuilder } from "./PostgresInsertQueryBuilder";
import { beforeEach, describe, expect, test, vi } from "vitest";

const metadata = {
  entity: { name: "users", namespace: null },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("age", { type: "integer" }),
  ],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const mockClient = {
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
};

describe("PostgresInsertQueryBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return empty result for empty values array", async () => {
    const builder = new PostgresInsertQueryBuilder(metadata, mockClient as any);
    builder.values([]);
    const result = await builder.execute();
    expect(result).toEqual({ rows: [], rowCount: 0 });
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  test("should execute insert for single row", async () => {
    const builder = new PostgresInsertQueryBuilder(metadata, mockClient as any);
    builder.values([{ id: "1", name: "Alice", age: 30 }] as any);
    await builder.execute();
    expect(mockClient.query).toHaveBeenCalledTimes(1);
  });

  test("should execute insert for multiple rows with identical keys", async () => {
    const builder = new PostgresInsertQueryBuilder(metadata, mockClient as any);
    builder.values([
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob", age: 25 },
    ] as any);
    await builder.execute();
    expect(mockClient.query).toHaveBeenCalledTimes(1);
  });

  test("should throw when rows have different key sets", async () => {
    const builder = new PostgresInsertQueryBuilder(metadata, mockClient as any);
    builder.values([
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob" },
    ] as any);
    await expect(builder.execute()).rejects.toThrow(
      'INSERT on "users": row 1 has different keys than row 0',
    );
  });

  test("should throw when rows have extra keys", async () => {
    const builder = new PostgresInsertQueryBuilder(metadata, mockClient as any);
    builder.values([
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob", age: 25 },
    ] as any);
    await expect(builder.execute()).rejects.toThrow(
      'INSERT on "users": row 1 has different keys than row 0',
    );
  });

  // P3: row-key mismatch error must be instanceof ProteusError
  test("should throw a ProteusError when rows have inconsistent keys", async () => {
    const builder = new PostgresInsertQueryBuilder(metadata, mockClient as any);
    builder.values([
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob" },
    ] as any);
    await expect(builder.execute()).rejects.toBeInstanceOf(ProteusError);
  });
});
