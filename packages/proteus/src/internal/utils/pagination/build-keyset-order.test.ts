import type { EntityMetadata } from "../../entity/types/metadata";
import { buildKeysetOrder, keysetOrderToRecord } from "./build-keyset-order";

const makeMetadata = (primaryKeys: Array<string>): EntityMetadata =>
  ({ primaryKeys }) as unknown as EntityMetadata;

describe("buildKeysetOrder", () => {
  it("should preserve user-provided order", () => {
    const result = buildKeysetOrder(
      { createdAt: "ASC", name: "DESC" },
      makeMetadata(["id"]),
    );
    expect(result).toMatchSnapshot();
  });

  it("should auto-append primary key when not included", () => {
    const result = buildKeysetOrder({ createdAt: "ASC" }, makeMetadata(["id"]));

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ column: "id", direction: "ASC" });
  });

  it("should not duplicate primary key if already in orderBy", () => {
    const result = buildKeysetOrder({ id: "DESC" }, makeMetadata(["id"]));

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ column: "id", direction: "DESC" });
  });

  it("should handle composite primary keys", () => {
    const result = buildKeysetOrder(
      { createdAt: "ASC" },
      makeMetadata(["tenantId", "id"]),
    );

    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({ column: "tenantId", direction: "ASC" });
    expect(result[2]).toEqual({ column: "id", direction: "ASC" });
  });

  it("should skip already-included composite PK columns", () => {
    const result = buildKeysetOrder(
      { tenantId: "ASC", createdAt: "DESC" },
      makeMetadata(["tenantId", "id"]),
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ column: "tenantId", direction: "ASC" });
    expect(result[1]).toEqual({ column: "createdAt", direction: "DESC" });
    expect(result[2]).toEqual({ column: "id", direction: "ASC" });
  });

  it("should skip falsy direction values", () => {
    const result = buildKeysetOrder(
      { createdAt: "ASC", name: undefined as any },
      makeMetadata(["id"]),
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ column: "createdAt", direction: "ASC" });
    expect(result[1]).toEqual({ column: "id", direction: "ASC" });
  });
});

describe("keysetOrderToRecord", () => {
  it("should convert entries to record", () => {
    const entries = [
      { column: "createdAt", direction: "ASC" as const },
      { column: "id", direction: "ASC" as const },
    ];

    expect(keysetOrderToRecord(entries)).toMatchSnapshot();
  });

  it("should flip directions when backward=true", () => {
    const entries = [
      { column: "createdAt", direction: "ASC" as const },
      { column: "name", direction: "DESC" as const },
      { column: "id", direction: "ASC" as const },
    ];

    expect(keysetOrderToRecord(entries, true)).toMatchSnapshot();
  });
});
