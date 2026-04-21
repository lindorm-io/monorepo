import { validate } from "./validate.js";
import { describe, expect, test } from "vitest";

describe("validate", () => {
  test("should validate", () => {
    expect(() =>
      validate(
        { one: "string" },
        { one: { $and: [{ $exists: true }, { $eq: "string" }] } },
      ),
    ).not.toThrow();
  });
});
