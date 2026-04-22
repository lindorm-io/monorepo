import { z } from "zod";
import { configuration } from "./configuration.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("configuration", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();

    process.env = {
      NODE_ENV: "test",
      ONE_PARENT_WITH_NUMBER: "456",
      ONE_PARENT_WITH_STRING: "replaced string value",
      TWO_PARENT_WITH_OBJECT_WITH_STRING: "replaced parent value",
      TWO_ARRAY: '["four", "five", "six"]',
      THREE_ARRAY: '["seven","eight","nine"]',
      FOUR_ARRAY: "[1,2,3]",
      SEVEN_BOOLEAN: "true",
      SEVEN_NOPE: "false",
    };
  });

  afterEach(() => {
    process.env = env;
  });

  test("should parse, validate, and merge configuration", () => {
    const config = configuration(
      {
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
        seven: z.object({
          boolean: z.boolean(),
          nope: z.boolean(),
        }),
        withDotEnvReplacement: z.string().optional(),
      },
      { scope: import.meta.url },
    );

    expect(config).toMatchObject({
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
      seven: {
        boolean: true,
        nope: false,
      },
      withDotEnvReplacement: "two",
    });

    // npm info is now read from the nearest package.json on disk — here
    // the test runs inside @lindorm/config itself, so we know the name
    // without hard-coding the (mutable) version.
    expect(config.npm.package.name).toBe("@lindorm/config");
    expect(typeof config.npm.package.version).toBe("string");
    expect(config.npm.package.version.length).toBeGreaterThan(0);
  });
});
