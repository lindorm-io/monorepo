import { resolve, join } from "path";
import { generateMessage } from "./generate-message";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { mkdir, writeFile } =
  await vi.importMock<typeof import("fs/promises")>("fs/promises");
const { Logger } =
  await vi.importMock<typeof import("@lindorm/logger")>("@lindorm/logger");

const defaultDir = resolve(process.cwd(), "./src/iris/messages");

describe("generateMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create message file with correct name", async () => {
    await generateMessage("OrderCreated", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "OrderCreated.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should generate file with Message decorator", async () => {
    await generateMessage("OrderCreated", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("@Message()");
  });

  it("should generate file with correct class name", async () => {
    await generateMessage("OrderCreated", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export class OrderCreated");
  });

  it("should generate file with a body field", async () => {
    await generateMessage("OrderCreated", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain('@Field("string")');
    expect(content).toContain("body!: string");
  });

  it("should generate correct imports", async () => {
    await generateMessage("OrderCreated", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain('import { Field, Message } from "@lindorm/iris"');
  });

  it("should use custom directory when provided", async () => {
    await generateMessage("OrderCreated", { directory: "./custom/messages" });

    const customDir = resolve(process.cwd(), "./custom/messages");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "OrderCreated.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create parent directory with mkdir recursive", async () => {
    await generateMessage("OrderCreated", {});

    expect(mkdir).toHaveBeenCalledWith(defaultDir, { recursive: true });
  });

  it("should throw on invalid name (lowercase)", async () => {
    await expect(generateMessage("orderCreated", {})).rejects.toThrow(
      "Invalid message name",
    );
  });

  it("should throw on invalid name (with spaces)", async () => {
    await expect(generateMessage("Order Created", {})).rejects.toThrow(
      "Invalid message name",
    );
  });

  it("should throw on invalid name (with special chars)", async () => {
    await expect(generateMessage("Order-Created", {})).rejects.toThrow(
      "Invalid message name",
    );
  });

  it("should not write files in dry-run mode", async () => {
    await generateMessage("OrderCreated", { dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log file content in dry-run mode", async () => {
    await generateMessage("OrderCreated", { dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("@Message()"));
  });

  it("should log success message", async () => {
    await generateMessage("OrderCreated", {});

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("OrderCreated.ts"),
    );
  });

  it("should prompt for name when not provided", async () => {
    const mockInput = vi.fn().mockResolvedValue("OrderCreated");
    vi.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    vi.resetModules();
    const { generateMessage: freshGenerate } = await import("./generate-message");

    vi.doMock("fs/promises", () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Message name"),
      }),
    );
  });
});
