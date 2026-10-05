import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { noUnreachedStep } from "./no-unreached-step.js";
import { readStepTexts } from "./read-step-texts.js";

vi.mock("node:fs", { spy: true });
vi.mock("./read-step-texts.js", { spy: true });

const ROOT = mkdtempSync(join(tmpdir(), "gherkin-no-unreached-step-cache-"));

afterAll(() => {
  rmSync(ROOT, { force: true, recursive: true });
});

const writeFile = (path: string, lines: Array<string>): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, lines.join("\n"));
};

const scenario = (name: string, step: string): Array<string> => [
  `Feature: ${name}`,
  "",
  `  Scenario: ${name}`,
  `    Given ${step}`,
];

const steps = (...expressions: Array<string>): string =>
  [
    'import { Binding, Given } from "@lindorm/gherkin";',
    "",
    "@Binding()",
    "export class Steps {",
    ...expressions.map(
      (expression, index) => `  @Given("${expression}") s${index}(): void {}`,
    ),
    "}",
  ].join("\n");

const lint = (
  cwd: string,
  code: string,
  options: Record<string, Array<string>> = {},
): Array<string> =>
  new Linter({ cwd })
    .verify(
      code,
      [
        {
          files: ["**/*.ts"],
          languageOptions: { parser: tseslint.parser },
          plugins: { gherkin: { rules: { "no-unreached-step": noUnreachedStep } } },
          rules: { "gherkin/no-unreached-step": ["error", options] },
        },
      ],
      join(cwd, "src", "shop.steps.ts"),
    )
    .map(({ message }) => message);

const project = (name: string): string => {
  const cwd = join(ROOT, name);
  writeFile(join(cwd, "src", "a.feature"), scenario("a", "step a"));
  writeFile(join(cwd, "src", "b.feature"), scenario("b", "step b"));
  return cwd;
};

describe("no-unreached-step feature cache", () => {
  beforeEach(() => {
    vi.mocked(readStepTexts).mockClear();
  });

  test("should compile each feature file once while one run lints several step files", () => {
    const cwd = project("once");

    expect(lint(cwd, steps("step a"))).toEqual([]);
    expect(lint(cwd, steps("step b"))).toEqual([]);
    expect(lint(cwd, steps("step c"))).toEqual([
      'No scenario step in the feature files matches "step c".',
    ]);

    expect(
      vi
        .mocked(readStepTexts)
        .mock.calls.map(([file]) => file)
        .sort(),
    ).toEqual([join(cwd, "src", "a.feature"), join(cwd, "src", "b.feature")]);
  });

  test("should compile no feature file for a file that declares no step", () => {
    const cwd = project("no-steps");

    expect(lint(cwd, "export const notAStep = 1;")).toEqual([]);
    expect(readStepTexts).not.toHaveBeenCalled();
  });

  test("should compile a changed feature file again, alone, so a long-lived lint process sees the new scenario", () => {
    const cwd = project("changed");

    expect(lint(cwd, steps("step c"))).toEqual([
      'No scenario step in the feature files matches "step c".',
    ]);

    writeFile(join(cwd, "src", "b.feature"), [
      ...scenario("b", "step b"),
      "",
      "  Scenario: c",
      "    Given step c",
    ]);

    expect(lint(cwd, steps("step c"))).toEqual([]);
    expect(
      vi
        .mocked(readStepTexts)
        .mock.calls.map(([file]) => file)
        .sort(),
    ).toEqual([
      join(cwd, "src", "a.feature"),
      join(cwd, "src", "b.feature"),
      join(cwd, "src", "b.feature"),
    ]);
  });

  test("should compile the feature files again once a new one appears", () => {
    const cwd = project("added");

    expect(lint(cwd, steps("step c"))).toHaveLength(1);

    writeFile(join(cwd, "src", "c.feature"), scenario("c", "step c"));

    expect(lint(cwd, steps("step c"))).toEqual([]);
  });

  test("should read a feature file again after a read that failed, though its stamp is unchanged", () => {
    const cwd = project("read-failure");

    vi.mocked(readStepTexts).mockReturnValueOnce(undefined);

    expect(lint(cwd, steps("step a", "step b"))).toHaveLength(1);
    expect(lint(cwd, steps("step a", "step b"))).toEqual([]);
    expect(readStepTexts).toHaveBeenCalledTimes(3);
  });

  test("should read no listed path that is not a regular file, so a feature symlink to a device or pipe cannot block the run", () => {
    const cwd = project("device");

    symlinkSync("/dev/null", join(cwd, "src", "device.feature"));

    expect(lint(cwd, steps("step a"))).toEqual([]);
    expect(
      vi
        .mocked(readStepTexts)
        .mock.calls.map(([file]) => file)
        .sort(),
    ).toEqual([join(cwd, "src", "a.feature"), join(cwd, "src", "b.feature")]);
  });

  test("should compile a feature file once whichever settings select it", () => {
    const cwd = project("alternating");
    const excludeB = { exclude: ["src/b.feature"] };

    expect(lint(cwd, steps("step b"))).toEqual([]);
    expect(lint(cwd, steps("step b"), excludeB)).toEqual([
      'No scenario step in the feature files matches "step b".',
    ]);
    expect(lint(cwd, steps("step b"))).toEqual([]);
    expect(lint(cwd, steps("step b"), { features: ["src/a.feature"] })).toHaveLength(1);

    expect(readStepTexts).toHaveBeenCalledTimes(2);
  });
});

describe("no-unreached-step exclude listing", () => {
  test("should read an excluded feature file whose directory cannot be lstat'ed rather than crash the run", () => {
    const cwd = project("unlstatable");

    vi.mocked(lstatSync).mockImplementationOnce(() => {
      throw new Error("EACCES: permission denied, lstat");
    });

    expect(lint(cwd, steps("step b"), { exclude: ["src/b.feature"] })).toEqual([]);
    expect(lstatSync).toHaveBeenCalledWith(join(cwd, "src"));
  });
});
