import { handleSelectColumns } from "./handle-select-columns";

describe("handleSelectColumns", () => {
  test("should return all columns", () => {
    expect(handleSelectColumns({})).toStrictEqual({
      text: "*",
      values: [],
    });
  });

  test("should return quoted strings", () => {
    expect(handleSelectColumns({ columns: ["test", "test2"] })).toStrictEqual({
      text: '"test", "test2"',
      values: [],
    });
  });

  test("should return aliased columns", () => {
    expect(
      handleSelectColumns({ columns: { test: "alias", test2: true, test3: 1 } }),
    ).toStrictEqual({
      text: '"test" AS "alias", "test2", "test3"',
      values: [],
    });
  });

  test("should return aggregated columns", () => {
    expect(
      handleSelectColumns({ aggregate: { function: "COUNT", column: "test" } }),
    ).toStrictEqual({
      text: 'COUNT("test")',
      values: [],
    });
  });

  test("should throw on invalid columns", () => {
    expect(() =>
      // @ts-expect-error
      handleSelectColumns({ columns: { test: 123 } }),
    ).toThrow();
  });
});
