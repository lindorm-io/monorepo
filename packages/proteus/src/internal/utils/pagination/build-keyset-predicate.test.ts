import { buildKeysetPredicate } from "./build-keyset-predicate";

describe("buildKeysetPredicate", () => {
  it("should build single column ASC forward predicate", () => {
    const result = buildKeysetPredicate(
      [{ column: "id", direction: "ASC" }],
      [42],
      false,
    );
    expect(result).toMatchSnapshot();
  });

  it("should build single column DESC forward predicate", () => {
    const result = buildKeysetPredicate(
      [{ column: "score", direction: "DESC" }],
      [100],
      false,
    );
    expect(result).toMatchSnapshot();
  });

  it("should build single column ASC backward predicate", () => {
    const result = buildKeysetPredicate([{ column: "id", direction: "ASC" }], [42], true);
    expect(result).toMatchSnapshot();
  });

  it("should build two column mixed-direction forward predicate", () => {
    // (a ASC, b DESC) after (c, d):
    // WHERE (a > c) OR (a = c AND b < d)
    const result = buildKeysetPredicate(
      [
        { column: "createdAt", direction: "ASC" },
        { column: "id", direction: "DESC" },
      ],
      ["2024-01-01", "abc"],
      false,
    );
    expect(result).toMatchSnapshot();
  });

  it("should build three column boolean expansion", () => {
    // (a ASC, b DESC, c ASC) after (x, y, z):
    // WHERE (a > x) OR (a = x AND b < y) OR (a = x AND b = y AND c > z)
    const result = buildKeysetPredicate(
      [
        { column: "category", direction: "ASC" },
        { column: "score", direction: "DESC" },
        { column: "id", direction: "ASC" },
      ],
      ["tech", 95, "abc-123"],
      false,
    );
    expect(result).toMatchSnapshot();
  });

  it("should build backward predicate with flipped operators", () => {
    const result = buildKeysetPredicate(
      [
        { column: "createdAt", direction: "ASC" },
        { column: "id", direction: "ASC" },
      ],
      ["2024-06-15", "xyz"],
      true,
    );
    expect(result).toMatchSnapshot();
  });

  it("should return empty predicate for empty entries", () => {
    const result = buildKeysetPredicate([], [], false);
    expect(result).toEqual({});
  });

  it("should handle null cursor values", () => {
    const result = buildKeysetPredicate(
      [
        { column: "name", direction: "ASC" },
        { column: "id", direction: "ASC" },
      ],
      [null, "abc"],
      false,
    );
    expect(result).toMatchSnapshot();
  });
});
