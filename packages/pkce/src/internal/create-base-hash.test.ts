import { createBaseHash } from "./create-base-hash";

describe("generateHash", () => {
  test("should resolve", () => {
    expect(createBaseHash("mM0DsmDihpzJxV_uMR-a2GMbfc2QX0i7jaq0a2SsmWI")).toEqual(
      "L5WToy1WgKDnxk_mYYFAf1GVBZFt5bQ-q6Jrmi2qtvY",
    );
  });
});
