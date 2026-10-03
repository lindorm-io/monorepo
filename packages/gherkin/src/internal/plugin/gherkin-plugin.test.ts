import { isString } from "@lindorm/is";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseAst } from "vite";
import { afterEach, describe, expect, test } from "vitest";
import { configDefaults } from "vitest/config";
import { capture, captureAsync, errorShape } from "../../__fixtures__/test-helpers.js";
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
      "",
      "  @slow",
      "  Scenario: dropped",
      '    Given a step "dropped"',
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

    describe("config", () => {
      test("should add the excluded feature files to test.exclude after vitest's default excludes when the consumer sets none", async () => {
        const root = await createTree({
          "src/a.feature": "Feature: a\n",
          "src/a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        const patch = await plugin.config({ root });

        expect(patch.test.exclude).toEqual([
          ...configDefaults.exclude,
          "src/a.wip.feature",
        ]);
      });

      test("should add only the excluded feature files when the consumer sets test.exclude — vite appends them to the consumer's list", async () => {
        const root = await createTree({
          "src/a.feature": "Feature: a\n",
          "src/a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        const patch = await plugin.config({ root, test: { exclude: ["**/custom/**"] } });

        expect(patch.test.exclude).toEqual(["src/a.wip.feature"]);
      });

      test("should leave test.exclude out of the patch when no feature file is excluded", async () => {
        const root = await createTree({ "src/a.feature": "Feature: a\n" });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        await expect(plugin.config({ root })).resolves.toEqual({ test: { tags: [] } });
      });

      test("should resolve a directory glob to the feature files beneath it, never a non-feature file", async () => {
        const root = await createTree({
          "drafts/draft.feature": "Feature: draft\n",
          "drafts/draft.test.ts": "export {};\n",
          "drafts/nested/deeper.feature": "Feature: deeper\n",
          "src/a.feature": "Feature: a\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["drafts/**"] });

        const patch = await plugin.config({ root });

        expect(patch.test.exclude).toEqual([
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

        const patch = await plugin.config({ root });

        expect(patch.test.exclude).toEqual([
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

        const patch = await plugin.config({ root });

        expect(patch.test.exclude).toEqual([
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

        const patch = await plugin.config({ root });

        expect(patch.test.exclude).toEqual([
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

        const patch = await plugin.config({ root });

        expect(patch.test.exclude).toEqual([
          ...configDefaults.exclude,
          'features/\\"draft\\".feature',
        ]);
      });

      test("should leave an excluded file out of the tag scan — its tags are neither validated nor declared", async () => {
        const root = await createTree({
          "src/a.feature": [
            "@kept",
            "Feature: a",
            "",
            "  Scenario: s",
            "    Given a step",
          ].join("\n"),
          "src/a.wip.feature": [
            "@issue(154) @parked",
            "Feature: a wip",
            "",
            "  Scenario: s",
            "    Given a step",
          ].join("\n"),
        });
        const [plugin] = gherkinPlugin({ exclude: ["src/**/*.wip.feature"] });

        const patch = await plugin.config({ root });

        expect(patch.test.tags).toEqual([{ name: "kept" }]);
      });

      test("should write each excluded feature file relative to test.dir, the directory vitest matches test.exclude against", async () => {
        const root = await createTree({
          "features/(draft)[1].wip.feature": "Feature: draft\n",
          "features/a.feature": "Feature: a\n",
          "features/nested/b.wip.feature": "Feature: b wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["features/**/*.wip.feature"] });

        const patch = await plugin.config({
          root,
          test: { dir: join(root, "features") },
        });

        expect(patch.test.exclude).toEqual([
          ...configDefaults.exclude,
          "\\(draft\\)\\[1\\].wip.feature",
          "nested/b.wip.feature",
        ]);
      });

      test("should give an excluded feature file outside test.dir no entry — vitest never globs it", async () => {
        const root = await createTree({
          "drafts/c.wip.feature": "Feature: c wip\n",
          "features-old/d.wip.feature": "Feature: d wip\n",
          "features/a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["**/*.wip.feature"] });

        const patch = await plugin.config({
          root,
          test: { dir: join(root, "features") },
        });

        expect(patch.test.exclude).toEqual([...configDefaults.exclude, "a.wip.feature"]);
      });

      test("should keep the entry of a file inside test.dir whose name starts with two dots — outside means a `..` segment", async () => {
        const root = await createTree({
          "features/..a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["**/*.wip.feature"] });

        const patch = await plugin.config({
          root,
          test: { dir: join(root, "features") },
        });

        expect(patch.test.exclude).toEqual([
          ...configDefaults.exclude,
          "..a.wip.feature",
        ]);
      });

      test("should leave test.exclude out of the patch when every excluded feature file lies outside test.dir", async () => {
        const root = await createTree({
          "drafts/c.wip.feature": "Feature: c wip\n",
          "features/a.feature": "Feature: a\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["**/*.wip.feature"] });

        await expect(
          plugin.config({ root, test: { dir: join(root, "features") } }),
        ).resolves.toEqual({ test: { tags: [] } });
      });

      test("should keep an excluded feature file outside test.dir out of the tag scan", async () => {
        const root = await createTree({
          "drafts/c.wip.feature": [
            "@issue(154) @parked",
            "Feature: c wip",
            "",
            "  Scenario: s",
            "    Given a step",
          ].join("\n"),
          "features/a.feature": "Feature: a\n",
        });
        const [plugin] = gherkinPlugin({
          exclude: ["**/*.wip.feature"],
          features: ["**/*.feature"],
        });

        const patch = await plugin.config({
          root,
          test: { dir: join(root, "features") },
        });

        expect(patch.test.tags).toEqual([]);
      });

      test("should resolve a relative test.dir against the working directory, as vitest does — never against the root", async () => {
        // realpath: process.cwd() reads back symlink-resolved (macOS /tmp is
        // /private/tmp), so the root must be too.
        const workingDirectory = await realpath(
          await createTree({ "pkg/features/a.wip.feature": "Feature: a wip\n" }),
        );
        const [plugin] = gherkinPlugin({ exclude: ["**/*.wip.feature"] });
        const testDirectory = process.cwd();

        process.chdir(workingDirectory);

        try {
          const patch = await plugin.config({
            root: join(workingDirectory, "pkg"),
            test: { dir: "pkg/features" },
          });

          expect(patch.test.exclude).toEqual([
            ...configDefaults.exclude,
            "a.wip.feature",
          ]);
        } finally {
          process.chdir(testDirectory);
        }
      });

      test("should anchor at the root when test.dir is empty, as vitest does", async () => {
        const root = await createTree({
          "features/a.wip.feature": "Feature: a wip\n",
        });
        const [plugin] = gherkinPlugin({ exclude: ["**/*.wip.feature"] });

        const patch = await plugin.config({ root, test: { dir: "" } });

        expect(patch.test.exclude).toEqual([
          ...configDefaults.exclude,
          "features/a.wip.feature",
        ]);
      });

      test("should defer a literal path matching no feature file to buildStart", async () => {
        const root = await createTree({ "src/a.feature": "Feature: a\n" });
        const [plugin] = gherkinPlugin({ exclude: ["src/missing.feature"] });

        await expect(plugin.config({ root })).resolves.toEqual({ test: { tags: [] } });
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

        const patch = await plugin.config({ root });
        plugin.configResolved({ root, test: { include: ["src/a.feature"] } });

        await expect(plugin.buildStart()).resolves.toBeUndefined();
        expect(patch.test.exclude).toEqual([...configDefaults.exclude, "src/b.feature"]);
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
