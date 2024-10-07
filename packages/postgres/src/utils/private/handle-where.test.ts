import { handleWhere } from "./handle-where";

describe("handleWhere", () => {
  test("should return empty string and values", () => {
    expect(handleWhere({})).toStrictEqual({ text: "", values: [] });
  });

  test("should return string", () => {
    expect(
      handleWhere<any>({ test1: 1, test2: "string", test3: true, test4: false }),
    ).toStrictEqual({
      text: ' WHERE "test1" = ? AND "test2" = ? AND "test3" = ? AND "test4" = ?',
      values: [1, "string", true, false],
    });
  });

  test("should return string with null", () => {
    expect(handleWhere<any>({ test1: null })).toStrictEqual({
      text: ' WHERE "test1" IS NULL',
      values: [],
    });
  });

  test("should return using $eq", () => {
    expect(handleWhere<any>({ test1: { $eq: 1 } })).toStrictEqual({
      text: ' WHERE "test1" = ?',
      values: [1],
    });
  });

  test("should return using $neq", () => {
    expect(handleWhere<any>({ test1: { $neq: 1 } })).toStrictEqual({
      text: ' WHERE "test1" <> ?',
      values: [1],
    });
  });

  test("should return using $gt", () => {
    expect(handleWhere<any>({ test1: { $gt: 1 } })).toStrictEqual({
      text: ' WHERE "test1" > ?',
      values: [1],
    });
  });

  test("should return using $gte", () => {
    expect(handleWhere<any>({ test1: { $gte: 1 } })).toStrictEqual({
      text: ' WHERE "test1" >= ?',
      values: [1],
    });
  });

  test("should return using $lt", () => {
    expect(handleWhere<any>({ test1: { $lt: 1 } })).toStrictEqual({
      text: ' WHERE "test1" < ?',
      values: [1],
    });
  });

  test("should return using $lte", () => {
    expect(handleWhere<any>({ test1: { $lte: 1 } })).toStrictEqual({
      text: ' WHERE "test1" <= ?',
      values: [1],
    });
  });

  test("should return using $like", () => {
    expect(handleWhere<any>({ test1: { $like: "string" } })).toStrictEqual({
      text: ' WHERE "test1" LIKE ?',
      values: ["string"],
    });
  });

  test("should return using $ilike", () => {
    expect(handleWhere<any>({ test1: { $ilike: "string" } })).toStrictEqual({
      text: ' WHERE "test1" ILIKE ?',
      values: ["string"],
    });
  });

  test("should return using $in", () => {
    expect(handleWhere<any>({ test1: { $in: [1, 2, 3] } })).toStrictEqual({
      text: ' WHERE "test1" IN (?, ?, ?)',
      values: [1, 2, 3],
    });
  });

  test("should return using $nin", () => {
    expect(handleWhere<any>({ test1: { $nin: [1, 2, 3] } })).toStrictEqual({
      text: ' WHERE "test1" NOT IN (?, ?, ?)',
      values: [1, 2, 3],
    });
  });

  test("should return using $between", () => {
    expect(handleWhere<any>({ test1: { $between: [1, 2] } })).toStrictEqual({
      text: ' WHERE "test1" BETWEEN ? AND ?',
      values: [1, 2],
    });
  });
});
