import type { ILogger } from "@lindorm/logger";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { mockScannerImport } from "../../../../../__fixtures__/mock-scanner-import";
import { loadMigrations } from "./load-migrations";

mockScannerImport();

let dir: string;

const mockLogger: ILogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
  child: jest.fn().mockReturnThis(),
} as unknown as ILogger;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "proteus-load-test-"));
  jest.clearAllMocks();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const writeMigrationClass = async (
  filename: string,
  id: string,
  ts: string,
): Promise<void> => {
  const content = `
    class Migration {
      id = "${id}";
      ts = "${ts}";
      async up() {}
      async down() {}
    }
    module.exports = { Migration };
  `;
  await writeFile(join(dir, filename), content, "utf-8");
};

describe("loadMigrations", () => {
  it("should load migration files from directory", async () => {
    await writeMigrationClass(
      "20260220090000-init.js",
      "aaa-111",
      "2026-02-20T09:00:00.000Z",
    );
    await writeMigrationClass(
      "20260221090000-add-users.js",
      "bbb-222",
      "2026-02-21T09:00:00.000Z",
    );

    const result = await loadMigrations(dir, mockLogger);

    expect(result).toHaveLength(2);
    expect(result[0].migration.id).toBe("aaa-111");
    expect(result[0].name).toBe("20260220090000-init");
    expect(result[1].migration.id).toBe("bbb-222");
    expect(result[1].name).toBe("20260221090000-add-users");
  });

  it("should sort by filename", async () => {
    await writeMigrationClass(
      "20260221090000-second.js",
      "bbb",
      "2026-02-21T09:00:00.000Z",
    );
    await writeMigrationClass(
      "20260220090000-first.js",
      "aaa",
      "2026-02-20T09:00:00.000Z",
    );

    const result = await loadMigrations(dir, mockLogger);

    expect(result[0].migration.id).toBe("aaa");
    expect(result[1].migration.id).toBe("bbb");
  });

  it("should skip test and fixture files", async () => {
    await writeMigrationClass(
      "20260220090000-init.js",
      "aaa",
      "2026-02-20T09:00:00.000Z",
    );
    await writeFile(join(dir, "helper.test.js"), "module.exports = {};", "utf-8");
    await writeFile(join(dir, "helper.fixture.js"), "module.exports = {};", "utf-8");

    const result = await loadMigrations(dir, mockLogger);

    expect(result).toHaveLength(1);
    expect(result[0].migration.id).toBe("aaa");
  });

  it("should skip index files", async () => {
    await writeMigrationClass(
      "20260220090000-init.js",
      "aaa",
      "2026-02-20T09:00:00.000Z",
    );
    await writeFile(join(dir, "index.js"), "module.exports = {};", "utf-8");

    const result = await loadMigrations(dir, mockLogger);

    expect(result).toHaveLength(1);
  });

  it("should skip exports that do not match MigrationInterface", async () => {
    const content = `
      class NotAMigration { foo = "bar"; }
      class ValidMigration {
        id = "aaa";
        ts = "2026-02-20T09:00:00.000Z";
        async up() {}
        async down() {}
      }
      module.exports = { NotAMigration, ValidMigration };
    `;
    await writeFile(join(dir, "20260220090000-mixed.js"), content, "utf-8");

    const result = await loadMigrations(dir, mockLogger);

    expect(result).toHaveLength(1);
    expect(result[0].migration.id).toBe("aaa");
    expect(result[0].name).toBe("20260220090000-mixed");
  });

  it("should return empty array for directory with no migration files", async () => {
    await writeFile(join(dir, "readme.txt"), "not a migration", "utf-8");

    const result = await loadMigrations(dir, mockLogger);

    expect(result).toHaveLength(0);
  });

  it("should throw for non-directory path", async () => {
    const filepath = join(dir, "single-file.js");
    await writeMigrationClass("single-file.js", "aaa", "2026-02-20T09:00:00.000Z");

    await expect(loadMigrations(filepath, mockLogger)).rejects.toThrow(
      "Migration path must be a directory",
    );
  });

  it("should throw on duplicate migration IDs", async () => {
    await writeMigrationClass(
      "20260220090000-first.js",
      "same-id",
      "2026-02-20T09:00:00.000Z",
    );
    await writeMigrationClass(
      "20260221090000-second.js",
      "same-id",
      "2026-02-21T09:00:00.000Z",
    );

    await expect(loadMigrations(dir, mockLogger)).rejects.toThrow(
      "Duplicate migration ID",
    );
  });

  it("should log warn when file has exports but none match MigrationInterface", async () => {
    await writeFile(
      join(dir, "20260220090000-broken.js"),
      `class Broken { foo = "bar"; } module.exports = { Broken };`,
      "utf-8",
    );

    const result = await loadMigrations(dir, mockLogger);

    expect(result).toHaveLength(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Migration file skipped — no exports matched MigrationInterface",
      expect.objectContaining({ file: "20260220090000-broken.js" }),
    );
  });

  it("should not treat null export as a migration (isObjectLike(null) guard)", async () => {
    // Regression: typeof null === "object" is true; isObjectLike(null) is false.
    // A file that exports null must not crash or produce a migration.
    await writeFile(
      join(dir, "20260220090000-null-export.js"),
      `module.exports = { default: null, value: null };`,
      "utf-8",
    );

    const result = await loadMigrations(dir, mockLogger);

    expect(result).toHaveLength(0);
  });

  it("should not treat primitive exports as migrations", async () => {
    // Strings and numbers are also not objects — isObjectLike guards these too.
    await writeFile(
      join(dir, "20260220090000-primitives.js"),
      `module.exports = { str: "not-a-migration", num: 42, bool: true };`,
      "utf-8",
    );

    const result = await loadMigrations(dir, mockLogger);

    expect(result).toHaveLength(0);
  });
});
