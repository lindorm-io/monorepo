import { readFileSync } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { createRequire } from "module";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { typewriter } from "./typewriter.js";
import { describe, expect, test } from "vitest";

describe("typewriter", () => {
  test("should generate types from JSON input", async () => {
    await expect(
      typewriter({
        input: [join(__dirname, "..", "__fixtures__", "test.json")],
        writeToDirectory: tmpdir(),
        typeName: "TestTypeJson",
      }),
    ).resolves.toMatchSnapshot();

    expect(
      readFileSync(join(tmpdir(), "TestTypeJson.typewriter.ts"), "utf-8"),
    ).toMatchSnapshot();
  });

  test("should generate types from YAML input", async () => {
    await expect(
      typewriter({
        input: [join(__dirname, "..", "__fixtures__", "directory")],
        writeToDirectory: tmpdir(),
        typeName: "TestTypeYaml",
      }),
    ).resolves.toMatchSnapshot();

    expect(
      readFileSync(join(tmpdir(), "TestTypeYaml.typewriter.ts"), "utf-8"),
    ).toMatchSnapshot();
  });

  test("should generate zod schemas that parse against the installed zod", async () => {
    const fixturePath = join(__dirname, "..", "__fixtures__", "test.json");

    const source = await typewriter({
      input: [fixturePath],
      typeName: "TestZod",
      output: "typescript-zod",
    });

    expect(source).toMatchSnapshot();

    const require = createRequire(import.meta.url);
    const zodEntry = pathToFileURL(require.resolve("zod")).href;

    const executable = source
      .replace(/^export type .+ = z\.infer<typeof .+>;$/gm, "")
      .replace(/from "zod"/g, `from "${zodEntry}"`);

    const dir = await mkdtemp(join(tmpdir(), "typewriter-zod-"));
    try {
      const filePath = join(dir, "schema.mjs");
      await writeFile(filePath, executable, "utf-8");

      const mod = await import(pathToFileURL(filePath).href);

      expect(mod.TestZodElementSchema).toBeDefined();
      expect(typeof mod.TestZodElementSchema.parse).toBe("function");

      const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

      for (const item of fixture) {
        expect(() => mod.TestZodElementSchema.parse(item)).not.toThrow();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
