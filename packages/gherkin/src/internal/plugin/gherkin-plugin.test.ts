import { isString } from "@lindorm/is";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAst } from "vite";
import { describe, expect, test } from "vitest";
import { captureAsync } from "../../__fixtures__/test-helpers.js";
import { buildFeatureModel } from "../model/build-feature-model.js";
import { gherkinPlugin } from "./gherkin-plugin.js";

const MODEL_PREFIX = "const model = ";

const extractModel = (source: string): unknown => {
  const line = source.split("\n").find((entry) => entry.startsWith(MODEL_PREFIX));

  if (isString(line)) {
    return JSON.parse(line.slice(MODEL_PREFIX.length, -1));
  }

  throw new Error("emitted source carries no model line");
};

const source = [
  "Feature: plugin transform",
  "",
  "  Scenario: one",
  '    Given a step "value"',
].join("\n");

describe("gherkinPlugin", () => {
  test("should identify itself and run before other transforms", () => {
    const plugin = gherkinPlugin();

    expect(plugin.name).toBe("lindorm-gherkin");
    // enforce "pre" is spike-verified load-bearing: swc must never see raw
    // .feature text.
    expect(plugin.enforce).toBe("pre");
  });

  describe("transform", () => {
    test("should ignore non-feature ids", () => {
      const plugin = gherkinPlugin();

      expect(plugin.transform("export const x = 1;", "/repo/src/a.ts")).toBeNull();
      expect(plugin.transform("Feature: f", "/repo/src/a.feature.ts")).toBeNull();
    });

    test("should ignore a non-feature id whose query mentions the extension", () => {
      const plugin = gherkinPlugin();

      expect(plugin.transform("export {};", "/repo/src/a.ts?path=b.feature")).toBeNull();
    });

    test("should transform a feature id and carry no source map", () => {
      const plugin = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(source, "/repo/pkg/src/features/a.feature");

      expect(result).not.toBeNull();
      // §4: lines travel inside the model; a map would point at generated code.
      expect(result?.map).toBeNull();
      expect(result?.code).toMatchSnapshot();
    });

    test("should strip a query suffix from the id before extension check and uri", () => {
      const plugin = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const plain = plugin.transform(source, "/repo/pkg/src/features/a.feature");
      const queried = plugin.transform(source, "/repo/pkg/src/features/a.feature?v=abc");

      expect(queried?.code).toBe(plain?.code);
      expect(extractModel(queried?.code as string)).toEqual(
        buildFeatureModel(source, "src/features/a.feature"),
      );
    });

    test("should compute the uri relative to the resolved root", () => {
      const plugin = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(source, "/repo/pkg/src/features/a.feature");

      expect(extractModel(result?.code as string)).toEqual(
        buildFeatureModel(source, "src/features/a.feature"),
      );
    });

    test("should emit byte-identical output for identical input", () => {
      const plugin = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const first = plugin.transform(source, "/repo/pkg/src/a.feature");
      const second = plugin.transform(source, "/repo/pkg/src/a.feature");

      expect(first?.code).toBe(second?.code);
    });

    test("should embed default step patterns root-absolute", () => {
      const plugin = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(source, "/repo/pkg/src/a.feature");

      expect(result?.code).toContain(
        'const stepModules = import.meta.glob(["/src/**/*.steps.ts"]);',
      );
    });

    test("should embed configured step patterns root-absolute", () => {
      const plugin = gherkinPlugin({ steps: ["steps/**/*.steps.ts", "/abs/*.steps.ts"] });
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(source, "/repo/pkg/src/a.feature");

      expect(result?.code).toContain(
        'const stepModules = import.meta.glob(["/steps/**/*.steps.ts","/abs/*.steps.ts"]);',
      );
    });

    test("should emit a valid module and a lossless model for hostile feature content", () => {
      const hostileSource = [
        "Feature: hostile ${payload} `feature`",
        "",
        '  Scenario: name with `backticks`, ${payload}, "; and back\\slash',
        "    Given a step with `${injection}`; characters",
      ].join("\n");

      const plugin = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(hostileSource, "/repo/pkg/src/hostile.feature");
      const code = result?.code as string;

      expect(parseAst(code).type).toBe("Program");
      expect(extractModel(code)).toEqual(
        buildFeatureModel(hostileSource, "src/hostile.feature"),
      );
    });
  });

  describe("buildStart", () => {
    test("should resolve when every feature file is covered, and reject with feature_not_included when one is not", async () => {
      const root = await mkdtemp(join(tmpdir(), "gherkin-plugin-"));

      try {
        await mkdir(join(root, "src"), { recursive: true });
        await writeFile(join(root, "src", "a.feature"), "Feature: a\n");

        const plugin = gherkinPlugin();
        plugin.configResolved({ root });

        await expect(plugin.buildStart()).resolves.toBeUndefined();

        await writeFile(join(root, "orphan.feature"), "Feature: orphan\n");

        const error = await captureAsync(() => plugin.buildStart());

        expect(error.code).toBe("feature_not_included");
        expect(error.data.orphans).toEqual(["orphan.feature"]);
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    });
  });
});
