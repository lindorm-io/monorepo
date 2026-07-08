import { describe, expect, test } from "vitest";
import { ScaffoldError } from "../errors/ScaffoldError.js";
import { resolveTarget } from "./resolve-target.js";

describe("resolveTarget", () => {
  test("prefers the arg over config and default", () => {
    expect(
      resolveTarget({ arg: "./arg", config: "./config", default: "./default" }),
    ).toBe("./arg");
  });

  test("falls back to config over default when arg is undefined", () => {
    expect(resolveTarget({ config: "./config", default: "./default" })).toBe("./config");
  });

  test("falls back to default when arg and config are undefined", () => {
    expect(resolveTarget({ default: "./default" })).toBe("./default");
  });

  test("throws target_unresolved when all are undefined", () => {
    expect(() => resolveTarget({})).toThrow(ScaffoldError);

    try {
      resolveTarget({});
    } catch (error) {
      expect((error as ScaffoldError).code).toBe("target_unresolved");
      expect((error as ScaffoldError).type).toBe(
        "urn:lindorm:scaffold:error:target_unresolved",
      );
    }
  });
});
