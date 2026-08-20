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

const extractModelLiteral = (source: string): string => {
  const line = source.split("\n").find((entry) => entry.startsWith(MODEL_PREFIX));

  if (isString(line)) {
    return line.slice(MODEL_PREFIX.length, -1);
  }

  throw new Error("emitted source carries no model line");
};

const extractModel = (source: string): unknown => JSON.parse(extractModelLiteral(source));

/**
 * Evaluates a literal the way the ENGINE evaluates the generated module — as
 * module code via a data: import, never JSON.parse, which uses own-property
 * semantics and so cannot reproduce the object-literal `__proto__` hazard.
 */
const evaluateAsModule = async (literal: string): Promise<unknown> => {
  const module = (await import(
    /* @vite-ignore */
    `data:text/javascript,${encodeURIComponent(`export const value = ${literal};`)}`
  )) as { value: unknown };

  return module.value;
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

    test("should keep a __proto__ Examples column through real evaluation of the transformed module", async () => {
      const protoSource = [
        "Feature: proto",
        "",
        "  Scenario Outline: reads <safe>",
        "    Given a <safe>",
        "",
        "    Examples:",
        "      | __proto__ | safe |",
        "      | evil      | ok   |",
      ].join("\n");

      const plugin = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(protoSource, "/repo/pkg/src/proto.feature");
      const code = result?.code as string;

      // rollup's real parser accepts the module...
      expect(parseAst(code).type).toBe("Program");

      // ...and evaluating the baked literal AS MODULE CODE keeps the column,
      // because the model carries entries. The trailing Record control shows
      // the shape this ruling forbids losing the key under the SAME
      // evaluation — the reason ScenarioNode.examplesRow is an entries array.
      const evaluated = (await evaluateAsModule(extractModelLiteral(code))) as {
        children: Array<{ examplesRow?: Array<[string, string]> }>;
      };
      const entries = evaluated.children[0].examplesRow;

      expect(entries).toEqual([
        ["__proto__", "evil"],
        ["safe", "ok"],
      ]);

      const record = (await evaluateAsModule(
        JSON.stringify(Object.fromEntries(entries as Array<[string, string]>)),
      )) as Record<string, string>;

      expect(Object.hasOwn(record, "__proto__")).toBe(false);
    });

    test("should keep a hostile DocString and a __proto__ table cell through real evaluation", async () => {
      const argumentSource = [
        "Feature: arguments",
        "",
        "  Scenario: hostile payloads",
        "    Given a hostile doc",
        '      """md',
        '      body ` ${payload} "; injection',
        '      """',
        "    And a hostile table",
        "      | __proto__ | safe |",
        "      | evil      | ok   |",
      ].join("\n");

      const plugin = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(argumentSource, "/repo/pkg/src/args.feature");
      const code = result?.code as string;

      // rollup's real parser accepts the module — the DocString body is data
      // inside the literal, never code.
      expect(parseAst(code).type).toBe("Program");

      const evaluated = (await evaluateAsModule(extractModelLiteral(code))) as {
        children: Array<{
          steps: Array<{
            argument?:
              | { kind: "doc-string"; content: string; mediaType?: string }
              | { kind: "data-table"; rows: Array<Array<string>> };
          }>;
        }>;
      };
      const [doc, table] = evaluated.children[0].steps;

      expect(doc.argument).toEqual({
        kind: "doc-string",
        content: 'body ` ${payload} "; injection',
        mediaType: "md",
      });
      // The rows ARRAY survives evaluation verbatim — the __proto__ hazard
      // only exists for Records, which DataTable.hashes() materializes via
      // Object.fromEntries at runtime (DataTable.test.ts).
      expect(table.argument).toEqual({
        kind: "data-table",
        rows: [
          ["__proto__", "safe"],
          ["evil", "ok"],
        ],
      });
    });
  });

  describe("transform-time selection", () => {
    const taggedSource = [
      "Feature: selection",
      "",
      "  @keep",
      "  Scenario: kept",
      '    Given a step "kept"',
      "",
      "  @slow",
      "  Scenario: dropped",
      '    Given a step "dropped"',
    ].join("\n");

    test("should omit scenarios the settings tags expression excludes — they never become tests", () => {
      const plugin = gherkinPlugin({ tags: "not @slow" });
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(taggedSource, "/repo/pkg/src/tagged.feature");
      const model = extractModel(result?.code as string) as {
        children: Array<{ name: string }>;
        expectedTests: number;
      };

      expect(model.children.map((child) => child.name)).toEqual(["kept"]);
      expect(model.expectedTests).toBe(1);
    });

    test("should emit the full model without a tags setting", () => {
      const plugin = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(taggedSource, "/repo/pkg/src/tagged.feature");
      const model = extractModel(result?.code as string) as {
        children: Array<{ name: string }>;
      };

      expect(model.children.map((child) => child.name)).toEqual(["kept", "dropped"]);
    });
  });

  describe("config", () => {
    test("should inject the scanned tag union as test.tags, skipping user-declared names", async () => {
      const root = await mkdtemp(join(tmpdir(), "gherkin-plugin-config-"));

      try {
        await mkdir(join(root, "src"), { recursive: true });
        await writeFile(
          join(root, "src", "a.feature"),
          [
            "@lane",
            "Feature: a",
            "",
            "  @smoke",
            "  Scenario: s",
            "    Given a step",
          ].join("\n"),
        );

        const plugin = gherkinPlugin();

        await expect(plugin.config({ root })).resolves.toEqual({
          test: { tags: [{ name: "lane" }, { name: "smoke" }] },
        });

        // A name the user config already declares is never re-declared —
        // vitest rejects a duplicate test.tags name at startup.
        await expect(
          plugin.config({ root, test: { tags: [{ name: "smoke" }] } }),
        ).resolves.toEqual({ test: { tags: [{ name: "lane" }] } });
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    });

    test("should default the scan root to the cwd — vite's own default root", async () => {
      // The vitest worker's cwd IS this package, so the default `features`
      // pattern finds the package's own fixture features; @lifecycle is the
      // one tag under src/ (src/__fixtures__/features/lifecycle.feature).
      await expect(gherkinPlugin().config({})).resolves.toEqual({
        test: { tags: [{ name: "lifecycle" }] },
      });
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
