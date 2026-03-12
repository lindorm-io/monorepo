import { buildCompoundId, buildIdFilter } from "./build-compound-id";

describe("buildCompoundId", () => {
  test("should return value directly for single PK", () => {
    expect(buildCompoundId(["id"], { id: "abc-123" })).toMatchSnapshot();
  });

  test("should return compound object with sorted keys for composite PK", () => {
    expect(
      buildCompoundId(["tenantId", "userId"], {
        tenantId: "t1",
        userId: "u1",
      }),
    ).toMatchSnapshot();
  });

  test("should sort keys alphabetically regardless of input order", () => {
    const result1 = buildCompoundId(["z", "a", "m"], { z: 3, a: 1, m: 2 });
    const result2 = buildCompoundId(["a", "m", "z"], { a: 1, m: 2, z: 3 });

    expect(result1).toMatchSnapshot();
    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });

  test("should handle numeric PK values", () => {
    expect(buildCompoundId(["id"], { id: 42 })).toMatchSnapshot();
  });

  test("should handle undefined values in compound PK", () => {
    expect(buildCompoundId(["a", "b"], { a: "val" })).toMatchSnapshot();
  });
});

describe("buildIdFilter", () => {
  test("should wrap single PK in _id filter", () => {
    expect(buildIdFilter(["id"], { id: "abc" })).toMatchSnapshot();
  });

  test("should wrap compound PK in _id filter", () => {
    expect(
      buildIdFilter(["tenantId", "userId"], {
        tenantId: "t1",
        userId: "u1",
      }),
    ).toMatchSnapshot();
  });
});
