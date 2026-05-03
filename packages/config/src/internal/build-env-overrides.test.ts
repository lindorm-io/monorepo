import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildEnvOverrides } from "./build-env-overrides.js";

describe("buildEnvOverrides", () => {
  test("returns an empty object when no env vars match", () => {
    const schema = z.object({ pylon: z.object({ kek: z.string() }) });
    expect(buildEnvOverrides(schema, {})).toEqual({});
  });

  test("uses double-underscore as the path separator", () => {
    const schema = z.object({
      pylon: z.object({ kek: z.string() }),
      database: z.object({
        postgres: z.object({ url: z.string() }),
      }),
    });

    expect(
      buildEnvOverrides(schema, {
        PYLON__KEK: "secret",
        DATABASE__POSTGRES__URL: "postgres://localhost:5432/app",
      }),
    ).toEqual({
      pylon: { kek: "secret" },
      database: { postgres: { url: "postgres://localhost:5432/app" } },
    });
  });

  test("converts camelCase segments to snake_case within CONSTANT_CASE", () => {
    const schema = z.object({
      database: z.object({ maxRetries: z.number() }),
      myService: z.object({ accessKey: z.string() }),
    });

    expect(
      buildEnvOverrides(schema, {
        DATABASE__MAX_RETRIES: "5",
        MY_SERVICE__ACCESS_KEY: "abc",
      }),
    ).toEqual({
      // safelyParse turns "5" into the JSON number 5; coerceAll on the
      // schema would equally accept the string and coerce it.
      database: { maxRetries: 5 },
      myService: { accessKey: "abc" },
    });
  });

  test("does NOT recognise single-underscore between segments", () => {
    const schema = z.object({
      pylon: z.object({ kek: z.string() }),
    });

    expect(buildEnvOverrides(schema, { PYLON_KEK: "would-be-legacy" })).toEqual({});
  });

  test("preserves empty-string values (not treated as unset)", () => {
    const schema = z.object({ flag: z.string() });
    expect(buildEnvOverrides(schema, { FLAG: "" })).toEqual({ flag: "" });
  });

  test("parses JSON-array env values via safelyParse", () => {
    const schema = z.object({ hosts: z.array(z.string()) });
    expect(buildEnvOverrides(schema, { HOSTS: '["a","b","c"]' })).toEqual({
      hosts: ["a", "b", "c"],
    });
  });

  test("leaves non-JSON env values as plain strings", () => {
    const schema = z.object({ name: z.string() });
    expect(buildEnvOverrides(schema, { NAME: "lindorm" })).toEqual({ name: "lindorm" });
  });

  test("walks through optional / default / nullable wrappers", () => {
    const schema = z.object({
      auth: z.object({ clientId: z.string() }).optional(),
      logger: z.object({ level: z.string() }).default({ level: "info" }),
    });

    expect(
      buildEnvOverrides(schema, {
        AUTH__CLIENT_ID: "client",
        LOGGER__LEVEL: "debug",
      }),
    ).toEqual({
      auth: { clientId: "client" },
      logger: { level: "debug" },
    });
  });

  test("ignores env vars that don't correspond to a schema leaf", () => {
    const schema = z.object({ pylon: z.object({ kek: z.string() }) });
    expect(
      buildEnvOverrides(schema, {
        PYLON__KEK: "x",
        UNRELATED__VAR: "y",
      }),
    ).toEqual({ pylon: { kek: "x" } });
  });
});
