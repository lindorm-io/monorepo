import { resolve, join } from "path";
import { Logger } from "@lindorm/logger";
import { mkdir, writeFile as _writeFile } from "fs/promises";
import { generateEntity } from "./generate-entity";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const writeFile = _writeFile as unknown as Mock;

vi.mock("fs/promises", async () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@lindorm/logger", () => ({
  Logger: {
    std: {
      log: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

const defaultDir = resolve(process.cwd(), "./src/proteus/entities");

describe("generateEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create entity file with correct name", async () => {
    await generateEntity("UserProfile", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "UserProfile.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should generate file with Entity decorator", async () => {
    await generateEntity("User", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("@Entity()");
  });

  it("should generate file with correct class name", async () => {
    await generateEntity("UserProfile", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export class UserProfile");
  });

  it("should generate file with PrimaryKey id field", async () => {
    await generateEntity("User", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("@PrimaryKey()");
    expect(content).toContain('@Field("uuid")');
    expect(content).toContain("id!: string");
  });

  it("should generate file with createdAt field", async () => {
    await generateEntity("User", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("createdAt!: Date");
  });

  it("should generate file with updatedAt field", async () => {
    await generateEntity("User", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("updatedAt!: Date");
  });

  it("should generate correct imports", async () => {
    await generateEntity("User", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain(
      'import { Entity, Field, PrimaryKey } from "@lindorm/proteus"',
    );
  });

  it("should use custom directory when provided", async () => {
    await generateEntity("User", { directory: "./custom/entities" });

    const customDir = resolve(process.cwd(), "./custom/entities");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "User.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create parent directory with mkdir recursive", async () => {
    await generateEntity("User", {});

    expect(mkdir).toHaveBeenCalledWith(defaultDir, { recursive: true });
  });

  it("should throw on invalid name (lowercase)", async () => {
    await expect(generateEntity("user", {})).rejects.toThrow("Invalid entity name");
  });

  it("should throw on invalid name (with spaces)", async () => {
    await expect(generateEntity("User Profile", {})).rejects.toThrow(
      "Invalid entity name",
    );
  });

  it("should throw on invalid name (with special chars)", async () => {
    await expect(generateEntity("User-Profile", {})).rejects.toThrow(
      "Invalid entity name",
    );
  });

  it("should not write files in dry-run mode", async () => {
    await generateEntity("User", { dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log file content in dry-run mode", async () => {
    await generateEntity("User", { dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("@Entity()"));
  });

  it("should log success message", async () => {
    await generateEntity("User", {});

    expect(Logger.std.info).toHaveBeenCalledWith(expect.stringContaining("User.ts"));
  });

  it("should prompt for name when not provided", async () => {
    const mockInput = vi.fn().mockResolvedValue("Order");
    vi.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    vi.resetModules();
    const { generateEntity: freshGenerate } = await import("./generate-entity");

    vi.doMock("fs/promises", () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Entity name"),
      }),
    );
  });
});
