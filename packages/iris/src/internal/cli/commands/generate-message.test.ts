import { resolve, join } from "path";
import { generateMessage } from "./generate-message";

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

const defaultDir = resolve(process.cwd(), "./src/iris/messages");

describe("generateMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const mockInput = jest.fn().mockResolvedValue("OrderCreated");
    jest.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    jest.resetModules();
    const { generateMessage: freshGenerate } = await import("./generate-message");

    jest.doMock("fs/promises", () => ({
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Message name"),
      }),
    );
  });
});
