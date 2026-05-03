import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { configuration } from "./configuration.js";

describe("configuration", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();

    process.env = {
      NODE_ENV: "test",
      ONE_PARENT__WITH_NUMBER: "456",
      ONE_PARENT__WITH_STRING: "replaced string value",
      TWO_PARENT__WITH_OBJECT__WITH_STRING: "replaced parent value",
      TWO_ARRAY: '["four", "five", "six"]',
      THREE_ARRAY: '["seven","eight","nine"]',
      FOUR_ARRAY: "[1,2,3]",
      SEVEN__BOOLEAN: "true",
      SEVEN__NOPE: "false",
    };
  });

  afterEach(() => {
    process.env = env;
  });

  test("merges YAML, NODE_CONFIG, and env vars; coerces and validates", () => {
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

  test("env vars work even when YAML has no scaffold for the key", () => {
    process.env = {
      ...process.env,
      PYLON__KEK: "kek-from-env",
      DATABASE__POSTGRES__URL: "postgres://localhost:5432/app",
    };

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
        pylon: z.object({ kek: z.string() }),
        database: z.object({
          postgres: z.object({ url: z.string() }),
        }),
      },
      { scope: import.meta.url },
    );

    expect(config.pylon.kek).toBe("kek-from-env");
    expect(config.database.postgres.url).toBe("postgres://localhost:5432/app");
  });
});
