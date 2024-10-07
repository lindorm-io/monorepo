import { handleReturning } from "./handle-returning";

describe("handleReturning", () => {
  test("should return empty string and values", () => {
    expect(handleReturning({})).toStrictEqual({ text: "", values: [] });
  });

  test("should return quoted strings", () => {
    expect(handleReturning({ returning: ["test", "test2"] })).toStrictEqual({
      text: ' RETURNING "test", "test2"',
      values: [],
    });
  });

  test("should return all columns", () => {
    expect(handleReturning({ returning: true })).toStrictEqual({
      text: " RETURNING *",
      values: [],
    });
  });
});
