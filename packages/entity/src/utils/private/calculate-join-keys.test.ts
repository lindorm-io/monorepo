import { calculateJoinKeys } from "./calculate-join-keys";

describe("calculateJoinKeys", () => {
  test("should calculate join keys for single primary key", () => {
    expect(calculateJoinKeys({ key: "author" }, { primaryKeys: ["id"] } as any)).toEqual({
      authorId: "id",
    });
  });

  test("should calculate join keys for composite primary key", () => {
    expect(
      calculateJoinKeys({ key: "two" }, { primaryKeys: ["first", "second"] } as any),
    ).toEqual({ twoFirst: "first", twoSecond: "second" });
  });

  test("should handle camelCase relation key", () => {
    expect(
      calculateJoinKeys({ key: "myRelation" }, { primaryKeys: ["id"] } as any),
    ).toEqual({ myRelationId: "id" });
  });

  test("should return empty object for empty primary keys", () => {
    expect(calculateJoinKeys({ key: "test" }, { primaryKeys: [] } as any)).toEqual({});
  });
});
