import { configuration } from "./configuration";

describe("configuration", () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();

    process.env = {
      NODE_ENV: "test",
      ONE_PARENT_WITH_NUMBER: "456",
      ONE_PARENT_WITH_STRING: "replaced string value",
      TWO_PARENT_WITH_OBJECT_WITH_STRING: "replaced parent value",
      TWO_ARRAY: '["four", "five", "six"]',
      THREE_ARRAY: "seven;eight;nine",
      FOUR_ARRAY: "[1,2,3]",
      FIVE_ARRAY: "1;2;3",
      npm_package_name: "@osprey-solutions-as/config",
      npm_package_version: "0.0.0",
    };
  });

  afterEach(() => {
    process.env = env;
  });

  test("should work", () => {
    expect(configuration()).toEqual({
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
      withDotEnvReplacement: "two",
      npm: {
        package: {
          name: "@osprey-solutions-as/config",
          version: "0.0.0",
        },
      },
    });
  });
});
