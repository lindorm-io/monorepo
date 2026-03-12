import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { writeMigrationFile } from "./write-migration-file";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "proteus-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writeMigrationFile", () => {
  it("should write file and return full path", async () => {
    const content = "// migration content";
    const filepath = await writeMigrationFile(dir, "20260220-test.ts", content);

    expect(filepath).toBe(join(dir, "20260220-test.ts"));
    const written = await readFile(filepath, "utf-8");
    expect(written).toBe(content);
  });

  it("should create subdirectories when needed", async () => {
    const nested = join(dir, "migrations");
    const filepath = await writeMigrationFile(nested, "20260220-test.ts", "content");

    expect(filepath).toBe(join(nested, "20260220-test.ts"));
    const written = await readFile(filepath, "utf-8");
    expect(written).toBe("content");
  });
});

describe("writeMigrationFile — error propagation", () => {
  it("should propagate mkdir error (unwritable path)", async () => {
    await expect(
      writeMigrationFile("/dev/null/impossible", "test.ts", "content"),
    ).rejects.toThrow();
  });

  it("should propagate writeFile error (directory as filename)", async () => {
    await expect(writeMigrationFile(dir, ".", "content")).rejects.toThrow();
  });
});
