import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { run } from "./cli.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MockInstance } from "vitest";

const FIXTURE = join(__dirname, "__fixtures__", "test.json");

const argv = (...args: Array<string>): Array<string> => ["node", "typewriter", ...args];

describe("cli run", () => {
  let directory: string;
  let log: MockInstance;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "typewriter-cli-"));
    log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    log.mockRestore();
    await rm(directory, { recursive: true, force: true });
  });

  // The guard used to be `isString<TypewriterOutput>`, which proved nothing but
  // stringness — every typo narrowed to the union and reached quicktype as an
  // unknown target language.
  test("should reject an output type outside the union", async () => {
    await expect(
      run(
        argv(
          "--files",
          FIXTURE,
          "--name",
          "Test",
          "--write",
          directory,
          "--output",
          "rust",
        ),
      ),
    ).rejects.toThrow(
      "Output type must be one of: typescript, typescript-zod. Received: rust.",
    );
  });

  test("should reject an output type that merely starts with a valid one", async () => {
    await expect(
      run(
        argv(
          "--files",
          FIXTURE,
          "--name",
          "Test",
          "--write",
          directory,
          "--output",
          "typescript-rust",
        ),
      ),
    ).rejects.toThrow("Output type must be one of: typescript, typescript-zod.");
  });

  test("should accept an output type in any casing", async () => {
    await expect(
      run(
        argv(
          "--files",
          FIXTURE,
          "--name",
          "Test",
          "--write",
          directory,
          "--output",
          "TypeScript-Zod",
        ),
      ),
    ).resolves.toBeUndefined();
  });

  test("should default the output type to typescript", async () => {
    await expect(
      run(argv("--files", FIXTURE, "--name", "Test", "--write", directory)),
    ).resolves.toBeUndefined();
  });

  test("should reject missing files", async () => {
    await expect(run(argv("--name", "Test", "--write", directory))).rejects.toThrow(
      "Please provide either a file or a directory path.",
    );
  });

  test("should reject a missing type name", async () => {
    await expect(run(argv("--files", FIXTURE, "--write", directory))).rejects.toThrow(
      "Please provide a type name to generate.",
    );
  });

  test("should reject a missing write directory", async () => {
    await expect(run(argv("--files", FIXTURE, "--name", "Test"))).rejects.toThrow(
      "Please provide a directory to write the generated type.",
    );
  });
});
