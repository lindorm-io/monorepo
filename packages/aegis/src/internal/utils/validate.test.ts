import { validate } from "./validate";

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
