import { resolve, join } from "path";
import { generateDto } from "./generate-dto";

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

describe("generateDto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("command", () => {
    const generate = generateDto("command");
    const defaultDir = resolve(process.cwd(), "./src/hermes/commands");

    it("should create command file with correct name", async () => {
      await generate("CreateOrder", {});

      expect(writeFile).toHaveBeenCalledWith(
        join(defaultDir, "CreateOrder.ts"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should generate file with Command decorator", async () => {
      await generate("CreateOrder", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain("@Command()");
      expect(content).toContain("export class CreateOrder");
    });

    it("should generate correct import", async () => {
      await generate("CreateOrder", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain('import { Command } from "@lindorm/hermes"');
    });
  });

  describe("query", () => {
    const generate = generateDto("query");
    const defaultDir = resolve(process.cwd(), "./src/hermes/queries");

    it("should create query file with correct name", async () => {
      await generate("GetOrderById", {});

      expect(writeFile).toHaveBeenCalledWith(
        join(defaultDir, "GetOrderById.ts"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should generate file with Query decorator", async () => {
      await generate("GetOrderById", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain("@Query()");
      expect(content).toContain("export class GetOrderById");
    });

    it("should generate correct import", async () => {
      await generate("GetOrderById", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain('import { Query } from "@lindorm/hermes"');
    });
  });

  describe("event", () => {
    const generate = generateDto("event");
    const defaultDir = resolve(process.cwd(), "./src/hermes/events");

    it("should create event file with correct name", async () => {
      await generate("OrderShipped", {});

      expect(writeFile).toHaveBeenCalledWith(
        join(defaultDir, "OrderShipped.ts"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should generate file with Event decorator", async () => {
      await generate("OrderShipped", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain("@Event()");
      expect(content).toContain("export class OrderShipped");
    });

    it("should generate correct import", async () => {
      await generate("OrderShipped", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain('import { Event } from "@lindorm/hermes"');
    });
  });

  describe("timeout", () => {
    const generate = generateDto("timeout");
    const defaultDir = resolve(process.cwd(), "./src/hermes/timeouts");

    it("should create timeout file with correct name", async () => {
      await generate("InactivityTimeout", {});

      expect(writeFile).toHaveBeenCalledWith(
        join(defaultDir, "InactivityTimeout.ts"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should generate file with Timeout decorator", async () => {
      await generate("InactivityTimeout", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain("@Timeout()");
      expect(content).toContain("export class InactivityTimeout");
    });

    it("should generate correct import", async () => {
      await generate("InactivityTimeout", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain('import { Timeout } from "@lindorm/hermes"');
    });
  });

  describe("aggregate", () => {
    const generate = generateDto("aggregate");
    const defaultDir = resolve(process.cwd(), "./src/hermes/aggregates");

    it("should create aggregate file with correct name", async () => {
      await generate("AccountAggregate", {});

      expect(writeFile).toHaveBeenCalledWith(
        join(defaultDir, "AccountAggregate.ts"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should generate file with Aggregate decorator", async () => {
      await generate("AccountAggregate", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain("@Aggregate()");
      expect(content).toContain("export class AccountAggregate");
    });

    it("should generate correct import", async () => {
      await generate("AccountAggregate", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain('import { Aggregate } from "@lindorm/hermes"');
    });
  });

  describe("saga", () => {
    const generate = generateDto("saga");
    const defaultDir = resolve(process.cwd(), "./src/hermes/sagas");

    it("should create saga file with correct name", async () => {
      await generate("OverdraftProtectionSaga", {});

      expect(writeFile).toHaveBeenCalledWith(
        join(defaultDir, "OverdraftProtectionSaga.ts"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should generate file with Saga decorator", async () => {
      await generate("OverdraftProtectionSaga", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain("@Saga()");
      expect(content).toContain("export class OverdraftProtectionSaga");
    });

    it("should generate correct import", async () => {
      await generate("OverdraftProtectionSaga", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain('import { Saga } from "@lindorm/hermes"');
    });
  });

  describe("view", () => {
    const generate = generateDto("view");
    const defaultDir = resolve(process.cwd(), "./src/hermes/views");

    it("should create view file with correct name", async () => {
      await generate("AccountSummaryView", {});

      expect(writeFile).toHaveBeenCalledWith(
        join(defaultDir, "AccountSummaryView.ts"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should generate file with View decorator", async () => {
      await generate("AccountSummaryView", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain("@View()");
      expect(content).toContain("export class AccountSummaryView");
    });

    it("should generate correct import", async () => {
      await generate("AccountSummaryView", {});

      const content = writeFile.mock.calls[0][1] as string;

      expect(content).toContain('import { View } from "@lindorm/hermes"');
    });
  });

  describe("shared behavior", () => {
    const generate = generateDto("command");

    it("should use custom directory when provided", async () => {
      await generate("CreateOrder", { directory: "./custom" });

      const customDir = resolve(process.cwd(), "./custom");

      expect(writeFile).toHaveBeenCalledWith(
        join(customDir, "CreateOrder.ts"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should throw on invalid name (lowercase)", async () => {
      await expect(generate("createOrder", {})).rejects.toThrow("Invalid command name");
    });

    it("should throw on invalid name (with spaces)", async () => {
      await expect(generate("Create Order", {})).rejects.toThrow("Invalid command name");
    });

    it("should not write files in dry-run mode", async () => {
      await generate("CreateOrder", { dryRun: true });

      expect(writeFile).not.toHaveBeenCalled();
    });

    it("should log file content in dry-run mode", async () => {
      await generate("CreateOrder", { dryRun: true });

      expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("@Command()"));
    });

    it("should log success message", async () => {
      await generate("CreateOrder", {});

      expect(Logger.std.info).toHaveBeenCalledWith(
        expect.stringContaining("CreateOrder.ts"),
      );
    });

    it("should create parent directory with mkdir recursive", async () => {
      await generate("CreateOrder", {});

      const defaultDir = resolve(process.cwd(), "./src/hermes/commands");

      expect(mkdir).toHaveBeenCalledWith(defaultDir, { recursive: true });
    });

    it("should prompt for name when not provided", async () => {
      const mockInput = jest.fn().mockResolvedValue("CreateOrder");
      jest.doMock("@inquirer/prompts", () => ({ input: mockInput }));

      jest.resetModules();
      const { generateDto: freshGenerateDto } = await import("./generate-dto");
      const freshGenerate = freshGenerateDto("command");

      jest.doMock("fs/promises", () => ({
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
      }));

      await freshGenerate(undefined, {});

      expect(mockInput).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Command name"),
        }),
      );
    });
  });
});
