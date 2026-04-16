import { loadConfig } from "./load-config";

describe("loadConfig", () => {
  test("should work", () => {
    expect(
      loadConfig({
        NODE_ENV: "test",
        FIVE_ARRAY: "[1,2,3]",
        FOUR_ARRAY: "[1,2,3]",
        npm_package_name: "@osprey-solutions-as/config",
        npm_package_version: "0.0.0",
        ONE_PARENT_WITH_NUMBER: "456",
        ONE_PARENT_WITH_STRING: "replaced string value",
        THREE_ARRAY: '["seven","eight","nine"]',
        TWO_ARRAY: '["four", "five", "six"]',
        TWO_PARENT_WITH_OBJECT_WITH_STRING: "replaced parent value",
        WITH_DOT_ENV_REPLACEMENT: "two",
      }),
    ).toEqual({
      env: "test",
      oneParent: {
        withNumber: 456,
        withString: "replaced string value",
        withNoReplacement: "one still here",
      },
      twoParent: {
        withObject: {
          withString: "replaced parent value",
          withNoReplacement: "two still here",
        },
      },
      twoArray: ["four", "five", "six"],
      threeArray: ["seven", "eight", "nine"],
      fourArray: [1, 2, 3],
      fiveArray: [1, 2, 3],
      sixNumberString: "987",
      seven: {
        boolean: false,
        nope: true,
      },
      withDotEnvReplacement: "two",
    });
  });
});
