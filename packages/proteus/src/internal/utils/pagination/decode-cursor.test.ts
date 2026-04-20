import { decodeCursor } from "./decode-cursor";
import { encodeCursor } from "./encode-cursor";
import { describe, expect, it } from "vitest";

describe("decodeCursor", () => {
  it("should decode a valid cursor token", () => {
    const token = encodeCursor(
      ["createdAt", "id"],
      ["ASC", "ASC"],
      ["2024-01-01T00:00:00.000Z", "abc-123"],
    );

    const result = decodeCursor(token, ["createdAt", "id"], ["ASC", "ASC"]);
    expect(result).toMatchSnapshot();
  });

  it("should reject malformed base64", () => {
    expect(() => decodeCursor("not-valid-json!!!", ["id"], ["ASC"])).toThrow(
      "Invalid pagination cursor: failed to decode token",
    );
  });

  it("should reject non-array payload", () => {
    const token = Buffer.from(JSON.stringify({ bad: true })).toString("base64url");
    expect(() => decodeCursor(token, ["id"], ["ASC"])).toThrow(
      "Invalid pagination cursor: expected [columns, directions, values]",
    );
  });

  it("should reject payload with wrong number of arrays", () => {
    const token = Buffer.from(JSON.stringify([["a"], ["ASC"]])).toString("base64url");
    expect(() => decodeCursor(token, ["a"], ["ASC"])).toThrow(
      "Invalid pagination cursor: expected [columns, directions, values]",
    );
  });

  it("should reject non-array elements", () => {
    const token = Buffer.from(JSON.stringify(["a", "ASC", 42])).toString("base64url");
    expect(() => decodeCursor(token, ["a"], ["ASC"])).toThrow(
      "Invalid pagination cursor: columns, directions, and values must be arrays",
    );
  });

  it("should reject mismatched array lengths", () => {
    const token = Buffer.from(JSON.stringify([["a", "b"], ["ASC"], [1]])).toString(
      "base64url",
    );
    expect(() => decodeCursor(token, ["a"], ["ASC"])).toThrow(
      "Invalid pagination cursor: columns, directions, and values must have equal length",
    );
  });

  it("should reject column count mismatch", () => {
    const token = encodeCursor(["a"], ["ASC"], [1]);
    expect(() => decodeCursor(token, ["a", "b"], ["ASC", "DESC"])).toThrow(
      "Pagination cursor mismatch: cursor has 1 columns but query has 2",
    );
  });

  it("should reject column name mismatch", () => {
    const token = encodeCursor(["name", "id"], ["ASC", "ASC"], ["foo", 1]);
    expect(() => decodeCursor(token, ["age", "id"], ["ASC", "ASC"])).toThrow(
      'Pagination cursor mismatch: cursor column "name" does not match query column "age"',
    );
  });

  it("should reject direction mismatch", () => {
    const token = encodeCursor(["id"], ["ASC"], [1]);
    expect(() => decodeCursor(token, ["id"], ["DESC"])).toThrow(
      'Pagination cursor mismatch: cursor direction "ASC" does not match query direction "DESC"',
    );
  });

  it("should accept valid cursor with null values", () => {
    const token = encodeCursor(["name", "id"], ["DESC", "ASC"], [null, "abc"]);
    const result = decodeCursor(token, ["name", "id"], ["DESC", "ASC"]);
    expect(result).toMatchSnapshot();
  });
});
