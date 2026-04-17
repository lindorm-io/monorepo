import { ProteusError } from "../../../../errors";
import { makeField } from "../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../entity/types/metadata";
import { PostgresUpdateQueryBuilder } from "./PostgresUpdateQueryBuilder";

const metadata = {
  entity: { name: "users", namespace: null },
  fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const mockClient = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };

describe("PostgresUpdateQueryBuilder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw when execute is called with set but no where", async () => {
    const builder = new PostgresUpdateQueryBuilder(metadata, mockClient as any);
    builder.set({ name: "Alice" } as any);
    await expect(builder.execute()).rejects.toThrow(
      'UPDATE on "users" requires at least one .where() predicate',
    );
  });

  test("should return empty result when no data is set", async () => {
    const builder = new PostgresUpdateQueryBuilder(metadata, mockClient as any);
    builder.where({ id: "abc" } as any);
    const result = await builder.execute();
    expect(result).toEqual({ rows: [], rowCount: 0 });
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  test("should execute when both set and where are provided", async () => {
    const builder = new PostgresUpdateQueryBuilder(metadata, mockClient as any);
    builder.set({ name: "Alice" } as any).where({ id: "abc" } as any);
    await builder.execute();
    expect(mockClient.query).toHaveBeenCalledTimes(1);
  });

  describe("ProteusError type assertions", () => {
    test("execute() with set but no predicates throws ProteusError (not bare Error)", async () => {
      const builder = new PostgresUpdateQueryBuilder(metadata, mockClient as any);
      builder.set({ name: "Alice" } as any);
      const error = await builder.execute().catch((e) => e);
      expect(error).toBeInstanceOf(ProteusError);
      expect((error as ProteusError).message).toContain(
        'UPDATE on "users" requires at least one .where() predicate',
      );
    });
  });
});
