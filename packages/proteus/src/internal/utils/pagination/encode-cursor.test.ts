import { encodeCursor } from "./encode-cursor.js";
import { describe, expect, it } from "vitest";

describe("encodeCursor", () => {
  it("should encode columns, directions, and values as base64url", () => {
    const result = encodeCursor(
      ["createdAt", "id"],
      ["ASC", "ASC"],
      ["2024-01-01T00:00:00.000Z", "abc-123"],
    );

    expect(typeof result).toBe("string");
    // Should be valid base64url (no +, /, or =)
    expect(result).not.toMatch(/[+/=]/);

    // Decode and verify
    const decoded = JSON.parse(Buffer.from(result, "base64url").toString("utf8"));
    expect(decoded).toMatchSnapshot();
  });

  it("should handle single column", () => {
    const result = encodeCursor(["id"], ["ASC"], [42]);

    const decoded = JSON.parse(Buffer.from(result, "base64url").toString("utf8"));
    expect(decoded).toMatchSnapshot();
  });

  it("should handle null values", () => {
    const result = encodeCursor(["name", "id"], ["DESC", "ASC"], [null, "abc"]);

    const decoded = JSON.parse(Buffer.from(result, "base64url").toString("utf8"));
    expect(decoded).toMatchSnapshot();
  });

  it("should handle numeric values", () => {
    const result = encodeCursor(["age", "id"], ["ASC", "ASC"], [25, 100]);

    const decoded = JSON.parse(Buffer.from(result, "base64url").toString("utf8"));
    expect(decoded).toMatchSnapshot();
  });
});
