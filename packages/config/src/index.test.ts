import { describe, expect, test } from "vitest";
import { z } from "zod";
import { type Configuration, type NpmInformation, configuration } from "./index.js";

// Regression for F4: NpmInformation (and a named Configuration<T> return type)
// must be on the public surface so a consumer can re-export a `config` value
// under `declaration: true` without TS2883 ("inferred type cannot be named
// without a reference to NpmInformation …"). These imports are typecheck-
// enforced — if the types stop being exported, `npm run typecheck` fails.

const SCHEMA = { server: z.object({ port: z.number() }) };

// Portable, nameable annotation of the configuration return type — exactly what
// a consumer needs to re-export config from a library with declaration emit.
type AppConfig = Configuration<typeof SCHEMA>;

describe("public type surface (F4)", () => {
  test("NpmInformation and Configuration are exported and nameable", () => {
    const npm: NpmInformation = { npm: { package: { name: "x", version: "1.0.0" } } };
    const cfg: AppConfig = { ...npm, server: { port: 3000 } };

    expect(cfg.npm.package.name).toBe("x");
    expect(cfg.server.port).toBe(3000);
    expect(typeof configuration).toBe("function");
  });
});
