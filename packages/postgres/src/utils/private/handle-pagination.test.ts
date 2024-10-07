import { handlePagination } from "./handle-pagination";

describe("handlePagination", () => {
  test("should return empty string and values", () => {
    expect(handlePagination({})).toStrictEqual({ text: "", values: [] });
  });

  test("should return limit string", () => {
    expect(handlePagination({ limit: 10 })).toStrictEqual({
      text: " LIMIT ?",
      values: [10],
    });
  });

  test("should return offset string", () => {
    expect(handlePagination({ offset: 10 })).toStrictEqual({
      text: " OFFSET ?",
      values: [10],
    });
  });

  test("should return limit and offset string", () => {
    expect(handlePagination({ limit: 10, offset: 10 })).toStrictEqual({
      text: " LIMIT ? OFFSET ?",
      values: [10, 10],
    });
  });

  test("should return page string", () => {
    expect(handlePagination({ page: 4, pageSize: 25 })).toStrictEqual({
      text: " LIMIT ? OFFSET ?",
      values: [25, 75],
    });
  });
});
