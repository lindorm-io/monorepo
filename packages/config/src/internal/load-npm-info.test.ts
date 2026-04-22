import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadNpmInfo } from "./load-npm-info.js";

describe("loadNpmInfo", () => {
  let sandbox: string;
  const originalEnv = process.env;

  beforeEach(() => {
    sandbox = join(tmpdir(), `load-npm-info-${Date.now()}-${Math.random()}`);
    mkdirSync(sandbox, { recursive: true });
    process.env = { ...originalEnv };
    delete process.env.npm_package_name;
    delete process.env.npm_package_version;
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
    process.env = originalEnv;
  });

  test("walks up from a scope file path to find the nearest package.json", () => {
    writeFileSync(
      join(sandbox, "package.json"),
      JSON.stringify({ name: "my-app", version: "1.2.3" }),
    );
    mkdirSync(join(sandbox, "dist"));
    const entry = join(sandbox, "dist", "index.js");
    writeFileSync(entry, "");

    expect(loadNpmInfo(entry)).toEqual({ name: "my-app", version: "1.2.3" });
  });

  test("walks up through multiple levels to reach the owning package", () => {
    writeFileSync(
      join(sandbox, "package.json"),
      JSON.stringify({ name: "parent-app", version: "0.9.0" }),
    );
    mkdirSync(join(sandbox, "src", "features", "example"), { recursive: true });
    const deep = join(sandbox, "src", "features", "example", "handler.ts");
    writeFileSync(deep, "");

    expect(loadNpmInfo(deep)).toEqual({ name: "parent-app", version: "0.9.0" });
  });

  test("accepts a file:// URL for scope (import.meta.url shape)", () => {
    writeFileSync(
      join(sandbox, "package.json"),
      JSON.stringify({ name: "my-app", version: "0.9.0" }),
    );
    mkdirSync(join(sandbox, "src", "pylon"), { recursive: true });
    const entry = join(sandbox, "src", "pylon", "config.ts");
    writeFileSync(entry, "");

    expect(loadNpmInfo(pathToFileURL(entry).href)).toEqual({
      name: "my-app",
      version: "0.9.0",
    });
  });

  test("coerces missing name/version fields to empty strings", () => {
    writeFileSync(join(sandbox, "package.json"), JSON.stringify({}));
    const entry = join(sandbox, "index.js");
    writeFileSync(entry, "");

    expect(loadNpmInfo(entry)).toEqual({ name: "", version: "" });
  });

  test("falls back to npm_package_* env vars when scope is omitted", () => {
    process.env.npm_package_name = "from-env";
    process.env.npm_package_version = "9.9.9";

    expect(loadNpmInfo()).toEqual({ name: "from-env", version: "9.9.9" });
  });

  test("falls back to env vars when scope resolves to no package.json", () => {
    process.env.npm_package_name = "fallback-app";
    process.env.npm_package_version = "2.0.0";

    expect(loadNpmInfo("/nonexistent-path-12345/entry.js")).toEqual({
      name: "fallback-app",
      version: "2.0.0",
    });
  });

  test("returns empty strings when scope is missing and env is empty", () => {
    expect(loadNpmInfo()).toEqual({ name: "", version: "" });
  });

  test("tolerates a malformed package.json and falls back to env", () => {
    writeFileSync(join(sandbox, "package.json"), "{not json");
    process.env.npm_package_name = "recovered";
    process.env.npm_package_version = "2.0.0";
    const entry = join(sandbox, "index.js");
    writeFileSync(entry, "");

    expect(loadNpmInfo(entry)).toEqual({ name: "recovered", version: "2.0.0" });
  });

  test("does NOT consult cwd — arbitrary cwd gives empty without scope", () => {
    // No scope, no env vars, no matter what cwd is — empty.
    expect(loadNpmInfo()).toEqual({ name: "", version: "" });
  });
});
