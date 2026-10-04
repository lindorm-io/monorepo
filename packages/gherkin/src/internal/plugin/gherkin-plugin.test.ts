import { isString } from "@lindorm/is";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseAst } from "vite";
import { afterEach, describe, expect, test } from "vitest";
import { configDefaults } from "vitest/config";
import { capture, captureAsync, errorShape } from "../../__fixtures__/test-helpers.js";
import { buildFeatureModel } from "../model/build-feature-model.js";
import type { GherkinVitePlugin } from "./gherkin-plugin.js";
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
  '    Then the step saw "value"',
].join("\n");

describe("gherkinPlugin", () => {
  test("should identify itself and run before other transforms", () => {
    const [plugin] = gherkinPlugin();

    expect(plugin.name).toBe("lindorm-gherkin");
    // enforce "pre" is spike-verified load-bearing: swc must never see raw
    // .feature text.
    expect(plugin.enforce).toBe("pre");
  });

  test("should wire the feature plugin and the lowering guard as one pair", () => {
    expect(gherkinPlugin().map((entry) => entry.name)).toEqual([
      "lindorm-gherkin",
      "lindorm-gherkin-lowering",
    ]);
  });

  describe("transform", () => {
    test("should ignore non-feature ids", () => {
      const [plugin] = gherkinPlugin();

      expect(plugin.transform("export const x = 1;", "/repo/src/a.ts")).toBeNull();
      expect(plugin.transform("Feature: f", "/repo/src/a.feature.ts")).toBeNull();
    });

    test("should ignore a non-feature id whose query mentions the extension", () => {
      const [plugin] = gherkinPlugin();

      expect(plugin.transform("export {};", "/repo/src/a.ts?path=b.feature")).toBeNull();
    });

    test("should transform a feature id and carry no source map", () => {
      const [plugin] = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(source, "/repo/pkg/src/features/a.feature");

      expect(result).not.toBeNull();
      // §4: lines travel inside the model; a map would point at generated code.
      expect(result?.map).toBeNull();
      expect(result?.code).toMatchSnapshot();
    });

    test("should strip a query suffix from the id before extension check and uri", () => {
      const [plugin] = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const plain = plugin.transform(source, "/repo/pkg/src/features/a.feature");
      const queried = plugin.transform(source, "/repo/pkg/src/features/a.feature?v=abc");

      expect(queried?.code).toBe(plain?.code);
      expect(extractModel(queried?.code as string)).toEqual(
        buildFeatureModel(source, "src/features/a.feature"),
      );
    });

    test("should compute the uri relative to the resolved root", () => {
      const [plugin] = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(source, "/repo/pkg/src/features/a.feature");

      expect(extractModel(result?.code as string)).toEqual(
        buildFeatureModel(source, "src/features/a.feature"),
      );
    });

    test("should emit byte-identical output for identical input", () => {
      const [plugin] = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const first = plugin.transform(source, "/repo/pkg/src/a.feature");
      const second = plugin.transform(source, "/repo/pkg/src/a.feature");

      expect(first?.code).toBe(second?.code);
    });

    test("should embed default step patterns root-absolute", () => {
      const [plugin] = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const result = plugin.transform(source, "/repo/pkg/src/a.feature");

      expect(result?.code).toContain(
        'const stepModules = import.meta.glob(["/src/**/*.steps.ts"]);',
      );
    });

    test("should embed configured step patterns root-absolute", () => {
      const [plugin] = gherkinPlugin({
        steps: ["steps/**/*.steps.ts", "/abs/*.steps.ts"],
      });
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
        "    Then the step carries `${injection}` verbatim",
      ].join("\n");

      const [plugin] = gherkinPlugin();
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
        "    Then the <safe> holds",
        "",
        "    Examples:",
        "      | __proto__ | safe |",
        "      | evil      | ok   |",
      ].join("\n");

      const [plugin] = gherkinPlugin();
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
        "    Then both payloads arrive as data",
      ].join("\n");

      const [plugin] = gherkinPlugin();
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
      '    Then the step saw "kept"',
      "",
      "  @slow",
      "  Scenario: dropped",
      '    Given a step "dropped"',
      '    Then the step saw "dropped"',
    ].join("\n");

    test("should omit scenarios the settings tags expression excludes — they never become tests", () => {
      const [plugin] = gherkinPlugin({ tags: "not @slow" });
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
      const [plugin] = gherkinPlugin();
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
            "    Then a check holds",
          ].join("\n"),
        );

        const [plugin] = gherkinPlugin();

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
      await expect(gherkinPlugin()[0].config({})).resolves.toEqual({
        test: { tags: [{ name: "lifecycle" }] },
      });
    });

    describe("test.root", () => {
      const tagged = (tag: string): string =>
        [
          tag,
          "Feature: f",
          "",
          "  Scenario: s",
          "    Given a step",
          "    Then a check holds",
        ].join("\n");

      test("should walk test.root when one is set — vitest runs from it, over vite's root and the working directory", async () => {
        const parent = await mkdtemp(join(tmpdir(), "gherkin-plugin-test-root-"));

        try {
          await mkdir(join(parent, "app", "src"), { recursive: true });
          await mkdir(join(parent, "vite", "src"), { recursive: true });
          await writeFile(join(parent, "app", "src", "a.feature"), tagged("@app"));
          await writeFile(join(parent, "vite", "src", "b.feature"), tagged("@vite"));

          const [plugin] = gherkinPlugin();
          const root = join(parent, "app");

          await expect(plugin.config({ test: { root } })).resolves.toEqual({
            test: { tags: [{ name: "app" }] },
          });
          await expect(
            plugin.config({ root: join(parent, "vite"), test: { root } }),
          ).resolves.toEqual({ test: { tags: [{ name: "app" }] } });
        } finally {
          await rm(parent, { force: true, recursive: true });
        }
      });

      test("should walk vite's root when test.root is empty, as vitest does", async () => {
        const parent = await mkdtemp(join(tmpdir(), "gherkin-plugin-test-root-"));

        try {
          await mkdir(join(parent, "vite", "src"), { recursive: true });
          await writeFile(join(parent, "vite", "src", "b.feature"), tagged("@vite"));

          const [plugin] = gherkinPlugin();

          await expect(
            plugin.config({ root: join(parent, "vite"), test: { root: "" } }),
          ).resolves.toEqual({ test: { tags: [{ name: "vite" }] } });
        } finally {
          await rm(parent, { force: true, recursive: true });
        }
      });
    });
  });

  describe("buildStart", () => {
    test("should resolve when every feature file is covered, and reject with feature_not_included when one is not", async () => {
      const root = await mkdtemp(join(tmpdir(), "gherkin-plugin-"));

      try {
        await mkdir(join(root, "src"), { recursive: true });
        await writeFile(join(root, "src", "a.feature"), "Feature: a\n");

        const [plugin] = gherkinPlugin();
        plugin.configResolved({ root, test: { include: ["src/**/*.feature"] } });

        await expect(plugin.buildStart()).resolves.toBeUndefined();

        await writeFile(join(root, "orphan.feature"), "Feature: orphan\n");

        const error = await captureAsync(() => plugin.buildStart());

        expect(error.code).toBe("feature_not_included");
        expect(error.data.orphans).toEqual(["orphan.feature"]);
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    });

    test("should reject with feature_not_collected when test.include cannot collect a covered feature", async () => {
      const root = await mkdtemp(join(tmpdir(), "gherkin-plugin-collect-"));

      try {
        await mkdir(join(root, "src"), { recursive: true });
        await writeFile(join(root, "src", "a.feature"), "Feature: a\n");

        const [plugin] = gherkinPlugin();
        // The overwrite accident: an include without the feature globs.
        plugin.configResolved({ root, test: { include: ["src/**/*.test.ts"] } });

        const error = await captureAsync(() => plugin.buildStart());

        expect(error.code).toBe("feature_not_collected");
        expect(error.data.uncollected).toEqual([
          { pattern: "src/**/*.feature", uri: "src/a.feature" },
        ]);
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    });

    test("should read test.include relative to vitest's dir — test.dir or --dir — where vitest globs it", async () => {
      const root = await mkdtemp(join(tmpdir(), "gherkin-plugin-dir-"));

      try {
        await mkdir(join(root, "features"), { recursive: true });
        await writeFile(join(root, "features", "a.feature"), "Feature: a\n");

        const [plugin] = gherkinPlugin({ features: ["features/**/*.feature"] });

        await plugin.config({ root });
        plugin.configResolved({ root, test: { include: ["*.feature"] } });
        plugin.configureVitest({
          project: { config: { dir: join(root, "features"), exclude: [] } },
        });

        await expect(plugin.buildStart()).resolves.toBeUndefined();
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    });

    test("should reject with feature_not_collected for a covered feature outside vitest's dir — vitest never globs it", async () => {
      const root = await mkdtemp(join(tmpdir(), "gherkin-plugin-dir-"));

      try {
        await mkdir(join(root, "features"), { recursive: true });
        await mkdir(join(root, "src"), { recursive: true });
        await writeFile(join(root, "features", "a.feature"), "Feature: a\n");
        await writeFile(join(root, "src", "b.feature"), "Feature: b\n");

        const [plugin] = gherkinPlugin({ features: ["**/*.feature"] });

        await plugin.config({ root });
        plugin.configResolved({ root, test: { include: ["**/*.feature"] } });
        plugin.configureVitest({
          project: { config: { dir: join(root, "features"), exclude: [] } },
        });

        const error = await captureAsync(() => plugin.buildStart());

        expect(error.code).toBe("feature_not_collected");
        expect(error.data.uncollected).toEqual([
          { pattern: "**/*.feature", uri: "src/b.feature" },
        ]);
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    });
  });

  describe("exclude", () => {
    const roots: Array<string> = [];

    const createTree = async (files: Record<string, string>): Promise<string> => {
      const root = await mkdtemp(join(tmpdir(), "gherkin-plugin-exclude-"));
      roots.push(root);

      for (const [path, content] of Object.entries(files)) {
        await mkdir(dirname(join(root, path)), { recursive: true });
        await writeFile(join(root, path), content);
      }

      return root;
    };

    afterEach(async () => {
      for (const root of roots.splice(0)) {
        await rm(root, { force: true, recursive: true });
      }
    });

    /**
     * The hooks in vitest's order up to the `test.exclude` write — config,
     * configResolved, configureVitest — returning vitest's resolved list
     * after it.
     */
    const resolveTestExclude = async (
      plugin: GherkinVitePlugin,
      {
        dir,
        exclude = [...configDefaults.exclude],
        root,
      }: { dir?: string; exclude?: Array<string>; root: string },
    ): Promise<Array<string>> => {
      const context = { project: { config: { dir, exclude } } };

      await plugin.config({ root });
      plugin.configResolved({ root });
      plugin.configureVitest(context);

      return context.project.config.exclude;
    };

    describe("config", () => {
      test("should leave an excluded file out of the tag scan — its tags are neither validated nor declared", async () => {
        const root = await createTree({
          "src/a.feature": [
            "@kept",
            "Feature: a",
            "",
            "  Scenario: s",
            "    Given a step",
            "    Then a check holds",
          ].join("\n"),
          "src/a.wip.feature": [
            "@issue(154) @parked",
            "Feature: a wip",
            "",
            "  Scenario: s",
            "    Given a step",
            "    Then a check holds",
          ].join("\n"),
        });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        const patch = await plugin.config({ root });

        expect(patch.test.tags).toEqual([{ name: "kept" }]);
      });

      test("should defer a literal path matching no feature file to buildStart", async () => {
        const root = await createTree({ "src/a.feature": "Feature: a\n" });
        const [plugin] = gherkinPlugin({ exclude: ["src/missing.feature"] });

        await expect(plugin.config({ root })).resolves.toEqual({ test: { tags: [] } });
      });
    });

    describe("configureVitest", () => {
      test("should append the excluded feature files to vitest's resolved test.exclude — its defaults when the consumer sets none", async () => {
        const root = await createTree({
          "src/a.feature": "Feature: a\n",
          "src/a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        await expect(resolveTestExclude(plugin, { root })).resolves.toEqual([
          ...configDefaults.exclude,
          "src/a.wip.feature",
        ]);
      });

      test("should append the excluded feature files to the consumer's own test.exclude", async () => {
        const root = await createTree({
          "src/a.feature": "Feature: a\n",
          "src/a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        await expect(
          resolveTestExclude(plugin, { exclude: ["**/custom/**"], root }),
        ).resolves.toEqual(["**/custom/**", "src/a.wip.feature"]);
      });

      test("should never write into the array vitest resolved — with no consumer list it is vitest's own default array", async () => {
        const root = await createTree({ "src/a.wip.feature": "Feature: a wip\n" });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });
        const resolved = ["**/node_modules/**", "**/.git/**"];

        await resolveTestExclude(plugin, { exclude: resolved, root });

        expect(resolved).toEqual(["**/node_modules/**", "**/.git/**"]);
      });

      test("should leave vitest's resolved test.exclude as it is when no feature file is excluded", async () => {
        const root = await createTree({ "src/a.feature": "Feature: a\n" });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        await expect(resolveTestExclude(plugin, { root })).resolves.toEqual([
          ...configDefaults.exclude,
        ]);
      });

      test("should resolve a directory glob to the feature files beneath it, never a non-feature file", async () => {
        const root = await createTree({
          "drafts/draft.feature": "Feature: draft\n",
          "drafts/draft.test.ts": "export {};\n",
          "drafts/nested/deeper.feature": "Feature: deeper\n",
          "src/a.feature": "Feature: a\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["drafts/**"] });

        await expect(resolveTestExclude(plugin, { root })).resolves.toEqual([
          ...configDefaults.exclude,
          "drafts/draft.feature",
          "drafts/nested/deeper.feature",
        ]);
      });

      test("should match a pattern as written — a lane-suffixed file escapes a plain-suffix pattern", async () => {
        const root = await createTree({
          "src/a.wip.feature": "Feature: a wip\n",
          "src/a.wip.integration.feature": "Feature: a wip integration\n",
          "src/a.wip.weekly.feature": "Feature: a wip weekly\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        await expect(resolveTestExclude(plugin, { root })).resolves.toEqual([
          ...configDefaults.exclude,
          "src/a.wip.feature",
        ]);
      });

      test("should escape glob syntax in an excluded path so vitest prunes that file alone", async () => {
        const root = await createTree({
          "src/(draft)[1].wip.feature": "Feature: draft\n",
          "src/draft1.feature": "Feature: draft1\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        await expect(resolveTestExclude(plugin, { root })).resolves.toEqual([
          ...configDefaults.exclude,
          "src/\\(draft\\)\\[1\\].wip.feature",
        ]);
      });

      test("should escape a | in an excluded path so vitest prunes that file alone, never the directory named before it", async () => {
        const root = await createTree({
          "features/draft/real.feature": "Feature: real\n",
          "features/draft|wip.feature": "Feature: draft or wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["features/*wip.feature"] });

        await expect(resolveTestExclude(plugin, { root })).resolves.toEqual([
          ...configDefaults.exclude,
          "features/draft\\|wip.feature",
        ]);
      });

      test('should escape a " in an excluded path so vitest prunes that file alone, never its unquoted namesake', async () => {
        const root = await createTree({
          'features/"draft".feature': "Feature: quoted draft\n",
          "features/draft.feature": "Feature: draft\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["features/?draft?.feature"] });

        await expect(resolveTestExclude(plugin, { root })).resolves.toEqual([
          ...configDefaults.exclude,
          'features/\\"draft\\".feature',
        ]);
      });

      test("should write each excluded feature file relative to vitest's dir — test.dir or --dir — where it matches test.exclude", async () => {
        const root = await createTree({
          "features/(draft)[1].wip.feature": "Feature: draft\n",
          "features/a.feature": "Feature: a\n",
          "features/nested/b.wip.feature": "Feature: b wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["features/**/*.wip.feature"] });

        await expect(
          resolveTestExclude(plugin, { dir: join(root, "features"), root }),
        ).resolves.toEqual([
          ...configDefaults.exclude,
          "\\(draft\\)\\[1\\].wip.feature",
          "nested/b.wip.feature",
        ]);
      });

      test("should give an excluded feature file outside vitest's dir no entry — vitest never globs it", async () => {
        const root = await createTree({
          "drafts/c.wip.feature": "Feature: c wip\n",
          "features-old/d.wip.feature": "Feature: d wip\n",
          "features/a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["**/*.wip.feature"] });

        await expect(
          resolveTestExclude(plugin, { dir: join(root, "features"), root }),
        ).resolves.toEqual([...configDefaults.exclude, "a.wip.feature"]);
      });

      test("should keep the entry of a file inside vitest's dir whose name starts with two dots — outside means a `..` segment", async () => {
        const root = await createTree({
          "features/..a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["**/*.wip.feature"] });

        await expect(
          resolveTestExclude(plugin, { dir: join(root, "features"), root }),
        ).resolves.toEqual([...configDefaults.exclude, "..a.wip.feature"]);
      });

      test("should leave vitest's resolved test.exclude as it is when every excluded feature file lies outside its dir", async () => {
        const root = await createTree({
          "drafts/c.wip.feature": "Feature: c wip\n",
          "features/a.feature": "Feature: a\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["**/*.wip.feature"] });

        await expect(
          resolveTestExclude(plugin, { dir: join(root, "features"), root }),
        ).resolves.toEqual([...configDefaults.exclude]);
      });

      test("should resolve a relative dir against the working directory, as vitest does — never against the root", async () => {
        // realpath: process.cwd() reads back symlink-resolved (macOS /tmp is
        // /private/tmp), so the root must be too.
        const workingDirectory = await realpath(
          await createTree({ "pkg/features/a.wip.feature": "Feature: a wip\n" }),
        );
        const [plugin] = gherkinPlugin({ exclude: ["**/*.wip.feature"] });
        const testDirectory = process.cwd();

        process.chdir(workingDirectory);

        try {
          await expect(
            resolveTestExclude(plugin, {
              dir: "pkg/features",
              root: join(workingDirectory, "pkg"),
            }),
          ).resolves.toEqual([...configDefaults.exclude, "a.wip.feature"]);
        } finally {
          process.chdir(testDirectory);
        }
      });

      test("should anchor at the root when vitest's dir is empty, as vitest does", async () => {
        const root = await createTree({
          "features/a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["**/*.wip.feature"] });

        await expect(resolveTestExclude(plugin, { dir: "", root })).resolves.toEqual([
          ...configDefaults.exclude,
          "features/a.wip.feature",
        ]);
      });

      test("should resolve the exclude patterns under test.root and write each file relative to it — vitest runs from test.root", async () => {
        const parent = await createTree({
          "app/features/a.wip.feature": "Feature: a wip\n",
          "vite/features/b.wip.feature": "Feature: b wip\n",
        });
        const root = join(parent, "app");
        const [plugin] = gherkinPlugin({ exclude: ["features/**/*.wip.feature"] });
        const context = { project: { config: { exclude: [...configDefaults.exclude] } } };

        await plugin.config({ root: join(parent, "vite"), test: { root } });
        plugin.configResolved({ root });
        plugin.configureVitest(context);

        expect(context.project.config.exclude).toEqual([
          ...configDefaults.exclude,
          "features/a.wip.feature",
        ]);
      });
    });

    describe("buildStart", () => {
      test("should exempt an excluded feature file outside every features pattern from the orphan guard", async () => {
        const root = await createTree({
          "drafts/draft.feature": "Feature: draft\n",
          "src/a.feature": "Feature: a\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["drafts/**"] });

        await plugin.config({ root });
        plugin.configResolved({ root, test: { include: ["src/**/*.feature"] } });

        await expect(plugin.buildStart()).resolves.toBeUndefined();
      });

      test("should exempt an excluded feature file test.include cannot collect from the collection guard", async () => {
        const root = await createTree({
          "src/a.feature": "Feature: a\n",
          "src/a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        await plugin.config({ root });
        plugin.configResolved({ root, test: { include: ["src/a.feature"] } });

        await expect(plugin.buildStart()).resolves.toBeUndefined();
      });

      test("should judge only the files excluded at config time — a matching file created later is guarded like any other", async () => {
        const root = await createTree({ "src/a.feature": "Feature: a\n" });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        await plugin.config({ root });
        plugin.configResolved({ root, test: { include: ["src/a.feature"] } });
        await writeFile(join(root, "src", "late.wip.feature"), "Feature: late\n");

        const error = await captureAsync(() => plugin.buildStart());

        expect(error.code).toBe("feature_not_collected");
        expect(error.data.uncollected).toEqual([
          { pattern: "src/**/*.feature", uri: "src/late.wip.feature" },
        ]);
      });

      test("should stop with exclude_unmatched naming every literal path that matches no feature file", async () => {
        const root = await createTree({ "src/a.feature": "Feature: a\n" });
        const [plugin] = gherkinPlugin({
          exclude: ["src/missing.feature", "src/**/*.none.feature", "src/gone.feature"],
        });

        await plugin.config({ root });
        plugin.configResolved({ root, test: { include: ["src/**/*.feature"] } });

        const error = await captureAsync(() => plugin.buildStart());

        expect(error.code).toBe("exclude_unmatched");
        expect(error.data).toEqual({
          unmatched: ["src/missing.feature", "src/gone.feature"],
        });
        expect(errorShape(error)).toMatchSnapshot();
      });

      test("should count a literal path naming a directory or a non-feature file as unmatched", async () => {
        const root = await createTree({
          "drafts/draft.feature": "Feature: draft\n",
          "src/a.feature": "Feature: a\n",
          "src/a.test.ts": "export {};\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["drafts", "src/a.test.ts"] });

        await plugin.config({ root });
        plugin.configResolved({ root, test: { include: ["src/**/*.feature"] } });

        const error = await captureAsync(() => plugin.buildStart());

        expect(error.code).toBe("exclude_unmatched");
        expect(error.data).toEqual({ unmatched: ["drafts", "src/a.test.ts"] });
      });

      test("should accept a glob that matches no feature file", async () => {
        const root = await createTree({ "src/a.feature": "Feature: a\n" });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        await plugin.config({ root });
        plugin.configResolved({ root, test: { include: ["src/**/*.feature"] } });

        await expect(plugin.buildStart()).resolves.toBeUndefined();
      });

      test("should accept a literal path naming an existing feature file, and exclude that file", async () => {
        const root = await createTree({
          "src/a.feature": "Feature: a\n",
          "src/b.feature": "Feature: b\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["src/b.feature"] });
        const context = { project: { config: { exclude: [...configDefaults.exclude] } } };

        await plugin.config({ root });
        plugin.configResolved({ root, test: { include: ["src/a.feature"] } });
        plugin.configureVitest(context);

        await expect(plugin.buildStart()).resolves.toBeUndefined();
        expect(context.project.config.exclude).toEqual([
          ...configDefaults.exclude,
          "src/b.feature",
        ]);
      });
    });
  });

  describe("lowering guard", () => {
    const lowered = "export class Steps { step() {} }\n";
    const unlowered = 'export class Steps { @Given("a step") step() {} }\n';

    test("should read the code every other transform is done with", () => {
      const [, lowering] = gherkinPlugin();

      expect(lowering.name).toBe("lindorm-gherkin-lowering");
      expect(lowering.transform.order).toBe("post");
    });

    test("should ignore a module outside the steps patterns", () => {
      const [plugin, lowering] = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      expect(lowering.transform.handler(unlowered, "/repo/pkg/src/a.ts")).toBeNull();
    });

    test("should pass a step module the pipeline lowered", () => {
      const [plugin, lowering] = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      expect(lowering.transform.handler(lowered, "/repo/pkg/src/a.steps.ts")).toBeNull();
    });

    test("should refuse a step module that still carries a decorator, named root-relative", () => {
      const [plugin, lowering] = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const error = capture(() =>
        lowering.transform.handler(unlowered, "/repo/pkg/src/a.steps.ts"),
      );

      expect(error.code).toBe("step_module_not_lowered");
      expect(error.data).toEqual({ uri: "src/a.steps.ts" });
    });

    test("should strip a query suffix before matching the steps patterns", () => {
      const [plugin, lowering] = gherkinPlugin();
      plugin.configResolved({ root: "/repo/pkg" });

      const error = capture(() =>
        lowering.transform.handler(unlowered, "/repo/pkg/src/a.steps.ts?v=abc"),
      );

      expect(error.data).toEqual({ uri: "src/a.steps.ts" });
    });

    test("should anchor the configured steps patterns at the resolved root", () => {
      const [plugin, lowering] = gherkinPlugin({ steps: ["steps/**/*.steps.ts"] });
      plugin.configResolved({ root: "/repo/pkg" });

      expect(
        lowering.transform.handler(unlowered, "/elsewhere/steps/a.steps.ts"),
      ).toBeNull();

      const error = capture(() =>
        lowering.transform.handler(unlowered, "/repo/pkg/steps/a.steps.ts"),
      );

      expect(error.data).toEqual({ uri: "steps/a.steps.ts" });
    });
  });
});
