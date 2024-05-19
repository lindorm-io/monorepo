import { _validate } from "./validate";

describe("validate", () => {
  test("should validate", () => {
    expect(() =>
      _validate(
        { one: "string" },
        { one: { $and: [{ $exists: true }, { $eq: "string" }] } },
      ),
    ).not.toThrow();
  });
});
