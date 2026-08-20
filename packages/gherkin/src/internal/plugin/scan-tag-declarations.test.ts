import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { captureAsync } from "../../__fixtures__/test-helpers.js";
import { scanTagDeclarations } from "./scan-tag-declarations.js";

describe("scanTagDeclarations", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "gherkin-scan-tags-"));
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "outside"), { recursive: true });

    await writeFile(
      join(root, "src", "a.feature"),
      ["@lane", "Feature: a", "", "  @smoke", "  Scenario: s", "    Given a step"].join(
        "\n",
      ),
    );
    await writeFile(
      join(root, "src", "b.feature"),
      ["@lane", "Feature: b", "", "  @slow", "  Scenario: s", "    Given a step"].join(
        "\n",
      ),
    );
    await writeFile(join(root, "src", "broken.feature"), "not gherkin at all\n");
    await writeFile(
      join(root, "outside", "c.feature"),
      ["@never-scanned", "Feature: c", "", "  Scenario: s", "    Given a step"].join(
        "\n",
      ),
    );
  });

  afterAll(async () => {
    await rm(root, { force: true, recursive: true });
  });

  test("should return the union across files, stripped and deduplicated across files", async () => {
    await expect(
      scanTagDeclarations({ declared: [], features: ["src/**/*.feature"], root }),
    ).resolves.toEqual([{ name: "lane" }, { name: "smoke" }, { name: "slow" }]);
  });

  test("should skip names the user config already declares — vitest rejects a duplicate declaration", async () => {
    await expect(
      scanTagDeclarations({
        declared: ["lane", "unrelated"],
        features: ["src/**/*.feature"],
        root,
      }),
    ).resolves.toEqual([{ name: "smoke" }, { name: "slow" }]);
  });

  test("should scan only files the features patterns cover", async () => {
    const names = (
      await scanTagDeclarations({ declared: [], features: ["src/**/*.feature"], root })
    ).map((tag) => tag.name);

    expect(names).not.toContain("never-scanned");
  });

  test("should return nothing for a root whose features carry no tags", async () => {
    await expect(
      scanTagDeclarations({ declared: [], features: ["outside/none/*.feature"], root }),
    ).resolves.toEqual([]);
  });

  test("should reject a parser-legal tag whose vitest NAME is invalid, anchored to its feature line", async () => {
    // Vitest rejects `issue(1234)` at config resolution — before any
    // transform — with a stack naming no file, so this scan is the only
    // place the authoring error can still be anchored.
    const invalid = join(root, "src", "invalid-name.feature");

    await writeFile(
      invalid,
      [
        "Feature: invalid",
        "",
        "  @issue(1234)",
        "  Scenario: s",
        "    Given a step",
      ].join("\n"),
    );

    try {
      const error = await captureAsync(() =>
        scanTagDeclarations({ declared: [], features: ["src/**/*.feature"], root }),
      );

      expect(error.code).toBe("invalid_tag_name");
      expect(error.message).toContain("Invalid tag name");
      expect(error.message).toContain("  @issue(1234)");
      expect(error.message).toContain("at src/invalid-name.feature:3:3");
    } finally {
      await rm(invalid, { force: true });
    }
  });
});
