import { isPromise } from "@lindorm/is";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
// @ts-expect-error untyped .mjs base config — bundled by vite's config loader.
import { createVitestConfig } from "../../../vitest.config.base.mjs";
// The package's own vitest config builds on the same base-module instance;
// importing it here makes the shape/identity pins below observe any mutation
// it makes to the base's shared mode tables (include IS INCLUDES_BY_MODE[mode]).
import "../vitest.config.js";
import { resolveSettings } from "./internal/plugin/resolve-settings.js";
import type { GherkinVitePlugin } from "./plugin.js";

type AnyConfig = {
  plugins: Array<{ name: string }>;
  test: {
    include: Array<string>;
    exclude: Array<string>;
    dangerouslyIgnoreUnhandledErrors: boolean;
    coverage: { exclude: Array<string> };
  };
};

type CreateVitestConfig = (settings?: {
  mode?: string;
  decorators?: boolean;
  setupFiles?: Array<string>;
  serial?: boolean;
  gherkin?: { features?: Array<string>; steps?: Array<string>; tags?: string };
}) => AnyConfig | Promise<AnyConfig>;

const create = createVitestConfig as CreateVitestConfig;

/**
 * The repo's shared vitest base config is infrastructure with no suite of its
 * own; the gherkin wiring lives there, so its contract is pinned here. The
 * non-gherkin half is the 42 other packages' config — it must stay
 * SYNCHRONOUS and shaped exactly as before the gherkin option existed.
 */
describe("createVitestConfig (vitest.config.base.mjs)", () => {
  describe("without gherkin", () => {
    test("should return synchronously — never a promise", () => {
      expect(isPromise(create({}))).toBe(false);
      expect(isPromise(create({ decorators: true, serial: true }))).toBe(false);
    });

    test("should keep the pre-gherkin shape for every mode", () => {
      expect(
        Object.fromEntries(
          ["default", "unit", "integration", "weekly"].map((mode) => {
            const config = create({ mode }) as AnyConfig;
            return [mode, { include: config.test.include, exclude: config.test.exclude }];
          }),
        ),
      ).toMatchSnapshot();
    });

    test("should carry no plugins without decorators and only swc with", () => {
      expect((create({}) as AnyConfig).plugins).toEqual([]);
      expect(
        (create({ decorators: true }) as AnyConfig).plugins.map((p) => p.name),
      ).toEqual(["swc"]);
    });

    test("should pin unhandled rejections as loud", () => {
      expect((create({}) as AnyConfig).test.dangerouslyIgnoreUnhandledErrors).toBe(false);
    });

    test("should exclude step definitions from coverage — they are test code", () => {
      expect((create({}) as AnyConfig).test.coverage.exclude).toContain("**/*.steps.ts");
    });

    test("should throw on an unknown mode", () => {
      expect(() => create({ mode: "nightly" })).toThrow('unknown mode "nightly"');
    });
  });

  describe("with gherkin", () => {
    test("should return a promise — vite awaits async config exports", () => {
      expect(isPromise(create({ decorators: true, gherkin: {} }))).toBe(true);
    });

    test("should still throw synchronously on an unknown mode", () => {
      expect(() => create({ mode: "nightly", gherkin: {} })).toThrow(
        'unknown mode "nightly"',
      );
    });

    test("should place the gherkin plugin before swc", async () => {
      const config = (await create({ decorators: true, gherkin: {} })) as AnyConfig;

      expect(config.plugins.map((p) => p.name)).toEqual(["lindorm-gherkin", "swc"]);
    });

    test("should derive every mode's feature includes and excludes from the one features list", async () => {
      expect(
        Object.fromEntries(
          await Promise.all(
            ["default", "unit", "integration", "weekly"].map(async (mode) => {
              const config = (await create({
                mode,
                decorators: true,
                gherkin: {},
              })) as AnyConfig;
              return [
                mode,
                { include: config.test.include, exclude: config.test.exclude },
              ];
            }),
          ),
        ),
      ).toMatchSnapshot();
    });

    test("should default features to the exact list resolveSettings defaults — one bound value, not two mirrors", async () => {
      const config = (await create({
        mode: "default",
        decorators: true,
        gherkin: {},
      })) as AnyConfig;

      expect(config.test.include).toEqual([
        "src/**/*.test.ts",
        ...resolveSettings({}).features,
      ]);
    });

    test("should throw synchronously on a features pattern not ending in .feature", () => {
      expect(() =>
        create({ decorators: true, gherkin: { features: ["src/**/*.gherkin"] } }),
      ).toThrow('must end with ".feature"');
    });

    test("should yield identical arrays across consecutive calls — no shared-table mutation", async () => {
      const first = (await create({
        mode: "default",
        decorators: true,
        gherkin: {},
      })) as AnyConfig;
      const second = (await create({
        mode: "default",
        decorators: true,
        gherkin: {},
      })) as AnyConfig;

      expect(second.test.include).toEqual(first.test.include);
      expect(second.test.exclude).toEqual(first.test.exclude);
      expect((create({}) as AnyConfig).test.include).toEqual(["src/**/*.test.ts"]);
    });

    test("should reject an unknown gherkin key — the spread forwards it to the plugin, which throws", async () => {
      // `{ ...gherkin, features }` in the base config forwards every consumer
      // key; the plugin's resolveSettings rejects the unknown ones, so a JS
      // consumer misspelling a key fails at config time instead of getting a
      // silent no-op.
      await expect(
        create({
          decorators: true,
          gherkin: { featurs: ["a/*.feature"] } as { features?: Array<string> },
        }),
      ).rejects.toThrow('Unknown gherkin setting "featurs"');
    });

    test("should forward a tags expression to the plugin — accepted when valid, loud when malformed", async () => {
      const config = (await create({
        decorators: true,
        gherkin: { tags: "not @slow" },
      })) as AnyConfig;

      expect(config.plugins.map((p) => p.name)).toEqual(["lindorm-gherkin", "swc"]);

      await expect(
        create({ decorators: true, gherkin: { tags: "@smoke and" } }),
      ).rejects.toThrow('Invalid tag expression "@smoke and" in gherkin setting "tags"');
    });

    test("should accept a fully-populated known-key gherkin config — the base config adds no unknown keys of its own", async () => {
      const config = (await create({
        decorators: true,
        gherkin: { features: ["features/**/*.feature"], steps: ["steps/**/*.steps.ts"] },
      })) as AnyConfig;

      expect(config.plugins.map((p) => p.name)).toEqual(["lindorm-gherkin", "swc"]);
    });

    test("should derive suffixed includes from a custom features list", async () => {
      const config = (await create({
        mode: "integration",
        decorators: true,
        gherkin: { features: ["features/**/*.feature", "extra/*.feature"] },
      })) as AnyConfig;

      expect(config.test.include).toContain("features/**/*.integration.feature");
      expect(config.test.include).toContain("extra/*.integration.feature");
      expect(config.test.include).not.toContain("features/**/*.feature");
    });
  });

  describe("with gherkin — the plugin receives the cadence-INDEPENDENT features list", () => {
    let root: string;

    beforeAll(async () => {
      root = await mkdtemp(join(tmpdir(), "gherkin-base-config-"));
      await mkdir(join(root, "src"));
      await writeFile(join(root, "src", "plain.feature"), "Feature: plain\n");
      await writeFile(
        join(root, "src", "docker.integration.feature"),
        "Feature: docker\n",
      );
    });

    afterAll(async () => {
      await rm(root, { recursive: true, force: true });
    });

    test("should pass buildStart's coverage check in integration mode — a lane-excluded plain feature is still covered", async () => {
      const config = (await create({
        mode: "integration",
        decorators: true,
        gherkin: {},
      })) as AnyConfig;

      const plugin = config.plugins[0] as unknown as GherkinVitePlugin;
      plugin.configResolved({ root });

      // Wired with the mode's resolved includes instead, src/plain.feature
      // would be an orphan and this would reject (assert-features-covered.ts).
      await expect(plugin.buildStart()).resolves.toBeUndefined();
    });

    test("should fail buildStart loudly when a feature matches no configured pattern", async () => {
      const config = (await create({
        mode: "default",
        decorators: true,
        gherkin: { features: ["src/covered/**/*.feature"] },
      })) as AnyConfig;

      const plugin = config.plugins[0] as unknown as GherkinVitePlugin;
      plugin.configResolved({ root });

      await expect(plugin.buildStart()).rejects.toThrow(
        "not covered by the configured `features` patterns",
      );
    });
  });
});
