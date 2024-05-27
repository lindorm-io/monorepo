import { findProcessEnvValue } from "./find-process-env-value";

describe("findProcessEnvValue", () => {
  const processEnv = {
    KEY_ONE: "string value",
    PARENT_WITH_NUMBER: "123",
    KEY_WITH_ARRAY: '["one","two","three"]',
    KEY_WITH_CUSTOM_ARRAY: "one;two;three",
  };

  test("should resolve value", () => {
    expect(findProcessEnvValue(processEnv, "keyOne")).toEqual("string value");
  });

  test("should resolve value with parent", () => {
    expect(findProcessEnvValue(processEnv, "withNumber", "parent")).toEqual(123);
  });

  test("should resolve value with array", () => {
    expect(findProcessEnvValue(processEnv, "key_with_array")).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  test("should resolve value with custom array", () => {
    expect(findProcessEnvValue(processEnv, "key_with_custom_array")).toEqual([
      "one",
      "two",
      "three",
    ]);
  });
});
