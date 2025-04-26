import { z } from "zod";
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
      THREE_ARRAY: '["seven","eight","nine"]',
      FOUR_ARRAY: "[1,2,3]",
      npm_package_name: "@lindorm/config",
      npm_package_version: "0.0.0",
    };
  });

  afterEach(() => {
    process.env = env;
  });

  test("should parse, validate, and merge configuration", () => {
    const config = configuration({
      env: z.string(),
      oneParent: z.object({
        withNumber: z.number(),
        withString: z.string(),
        withNoReplacement: z.string(),
      }),
      twoParent: z.object({
        withObject: z.object({
          withString: z.string(),
          withNoReplacement: z.string(),
        }),
      }),
      twoArray: z.array(z.string()),
      threeArray: z.array(z.string()),
      fourArray: z.array(z.number()),
      fiveArray: z.array(z.string()),
      sixNumberString: z.number(),
      withDotEnvReplacement: z.string().optional(),
    });

    expect(config).toEqual({
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
      fiveArray: ["one", "two", "three"],
      sixNumberString: 987,
      withDotEnvReplacement: "two",
      npm: { package: { name: "@lindorm/config", version: "0.0.0" } },
    });
  });
});
