import {
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Linter } from "eslint";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { afterAll, describe, expect, test } from "vitest";
import * as entry from "./eslint.js";
import gherkin from "./eslint.js";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

const MANIFEST = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));

const README = readFileSync(join(PACKAGE_ROOT, "README.md"), "utf8");

const README_SNIPPET = /## Lint: unreached steps\n[\s\S]*?```js\n([\s\S]*?)```/.exec(
  README,
)?.[1];

const README_WAIVER = /## Lint: unreached steps\n[\s\S]*?```ts\n([\s\S]*?)```/.exec(
  README,
)?.[1];

const WAIVER_DIRECTIVE = "// eslint-disable-next-line gherkin/no-unreached-step -- ";

const README_IMPORT = 'import gherkin from "@lindorm/gherkin/eslint";\n';

const PROJECT = mkdtempSync(join(tmpdir(), "gherkin-eslint-entry-"));

afterAll(() => {
  rmSync(PROJECT, { force: true, recursive: true });
});

const writeFeature = (file: string, step: string): void => {
  const path = join(PROJECT, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    ["Feature: Shop", "", "  Scenario: shop", `    Given ${step}`].join("\n"),
  );
};

writeFeature("src/shop.feature", "the shop is open");
writeFeature("other/elsewhere.feature", "the shop is elsewhere");

const STEPS = [
  'import { Binding, Given } from "@lindorm/gherkin";',
  "",
  "@Binding()",
  "export class ShopSteps {",
  '  @Given("the shop is open") open(): void {}',
  '  @Given("the shop is elsewhere") elsewhere(): void {}',
  "}",
].join("\n");

const UNREACHED_MESSAGE =
  'No scenario step in the feature files matches "the shop is elsewhere".';

const lintSteps = async (config: Array<Linter.Config>, code: string = STEPS) => {
  const eslint = new ESLint({
    cwd: PROJECT,
    overrideConfig: [
      { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } },
      ...config,
    ],
    overrideConfigFile: true,
  });
  const [result] = await eslint.lintText(code, {
    filePath: join(PROJECT, "src", "shop.steps.ts"),
  });

  return result.messages.map(({ line, message, ruleId, severity }) => ({
    line,
    message,
    ruleId,
    severity,
  }));
};

const evaluateReadmeConfig = (): Array<Linter.Config> => {
  const snippet = README_SNIPPET ?? "";

  expect(snippet).toContain(README_IMPORT);

  const body = snippet.replace(README_IMPORT, "").replace("export default", "return");

  return new Function("gherkin", body)(gherkin);
};

const readReadmeWaiver = () => {
  const lines = (README_WAIVER ?? "").split("\n");

  return {
    directive: lines.findIndex((line) => line.trim().startsWith(WAIVER_DIRECTIVE)),
    lines,
  };
};

describe("@lindorm/gherkin/eslint", () => {
  test("should default-export the plugin and nothing else", () => {
    expect(Object.keys(entry)).toEqual(["default"]);
  });

  test("should name the plugin by its package and version", () => {
    expect(gherkin.meta).toEqual({ name: "@lindorm/gherkin", version: MANIFEST.version });
  });

  test("should carry the no-unreached-step rule alone", () => {
    expect(Object.keys(gherkin.rules)).toEqual(["no-unreached-step"]);
  });

  test("should set the rule to error in the recommended config", () => {
    expect(gherkin.configs.recommended.rules).toEqual({
      "gherkin/no-unreached-step": "error",
    });
  });

  test("should run the README config at the consumer's warn severity, reading src/**/*.feature from the working directory by default", async () => {
    expect(await lintSteps(evaluateReadmeConfig())).toEqual([
      {
        line: 6,
        message: UNREACHED_MESSAGE,
        ruleId: "gherkin/no-unreached-step",
        severity: 1,
      },
    ]);
  });

  test("should waive a step whose decorator wraps with the README's directive on the line above the expression string", async () => {
    const { directive, lines } = readReadmeWaiver();

    expect(lines[directive - 1]?.trim()).toMatch(/^@(Given|When|Then)\($/);
    expect(await lintSteps(evaluateReadmeConfig(), lines.join("\n"))).toEqual([]);
  });

  test("should report the README's wrapped step on its expression string once the directive is gone", async () => {
    const { directive, lines } = readReadmeWaiver();
    const expression = /"(.+)"/.exec(lines[directive + 1] ?? "")?.[1];

    expect(
      await lintSteps(
        evaluateReadmeConfig(),
        lines.filter((_, index) => index !== directive).join("\n"),
      ),
    ).toEqual([
      {
        line: directive + 1,
        message: `No scenario step in the feature files matches "${expression}".`,
        ruleId: "gherkin/no-unreached-step",
        severity: 1,
      },
    ]);
  });

  test("should report at error severity under the recommended config", async () => {
    expect(
      await lintSteps([{ files: ["**/*.steps.ts"], ...gherkin.configs.recommended }]),
    ).toEqual([
      {
        line: 6,
        message: UNREACHED_MESSAGE,
        ruleId: "gherkin/no-unreached-step",
        severity: 2,
      },
    ]);
  });

  test("should let a consumer config name the plugin beside the recommended config", async () => {
    expect(
      await lintSteps([
        gherkin.configs.recommended,
        {
          files: ["**/*.steps.ts"],
          plugins: { gherkin },
          rules: { "gherkin/no-unreached-step": "off" },
        },
      ]),
    ).toEqual([]);
  });

  test("should map the ./eslint subpath to the built entry and keep eslint an optional peer from 9", () => {
    expect(MANIFEST.exports["./eslint"]).toEqual({
      types: "./dist/eslint.d.ts",
      default: "./dist/eslint.js",
    });
    expect(MANIFEST.peerDependencies.eslint).toBe(">=9");
    expect(MANIFEST.peerDependenciesMeta.eslint).toEqual({ optional: true });
  });

  test("should stay out of every module the vite plugin, the runtime and the decorators load", () => {
    const importers = globSync("src/**/*.ts", { cwd: PACKAGE_ROOT })
      .filter(
        (file) =>
          file.endsWith(".test.ts") === false &&
          file !== "src/eslint.ts" &&
          file.startsWith("src/internal/eslint/") === false,
      )
      .filter((file) =>
        [
          ...readFileSync(join(PACKAGE_ROOT, file), "utf8").matchAll(
            /(?:from|import)\s*\(?\s*["']([^"']+)["']/g,
          ),
        ].some(([, specifier]) => /(^|\/)eslint($|\/|\.js$)/.test(specifier)),
      );

    expect(importers).toEqual([]);
  });
});
