import { resolve, join } from "path";
import { generateEntity } from "./generate-entity";

jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@lindorm/logger", () => ({
  Logger: {
    std: {
      log: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  },
}));

const { mkdir, writeFile } = jest.requireMock("fs/promises");
const { Logger } = jest.requireMock("@lindorm/logger");

const defaultDir = resolve(process.cwd(), "./src/proteus/entities");

describe("generateEntity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const mockInput = jest.fn().mockResolvedValue("Order");
    jest.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    jest.resetModules();
    const { generateEntity: freshGenerate } = await import("./generate-entity");

    jest.doMock("fs/promises", () => ({
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Entity name"),
      }),
    );
  });
});
