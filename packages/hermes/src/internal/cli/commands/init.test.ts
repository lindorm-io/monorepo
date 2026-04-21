import { resolve, join } from "path";
import { mkdir as _mkdir, writeFile as _writeFile } from "fs/promises";
import { Logger as _Logger } from "@lindorm/logger";
import { init } from "./init.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

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

const mkdir = _mkdir as unknown as Mock;
const writeFile = _writeFile as unknown as Mock;
const Logger = _Logger as unknown as { std: Record<string, Mock> };

const defaultDir = resolve(process.cwd(), "./src/hermes");

describe("init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create source.ts", async () => {
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "source.ts"),
      expect.stringContaining("Hermes"),
      "utf-8",
    );
  });

  it("should create commands directory", async () => {
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "commands", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should create queries directory", async () => {
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "queries", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should create events directory", async () => {
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "events", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should create timeouts directory", async () => {
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "timeouts", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should create aggregates directory", async () => {
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "aggregates", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should create sagas directory", async () => {
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "sagas", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should create views directory", async () => {
    await init({});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "views", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should use custom directory when provided", async () => {
    await init({ directory: "./custom/path" });

    const customDir = resolve(process.cwd(), "./custom/path");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "source.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should not write files in dry-run mode", async () => {
    await init({ dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log file paths in dry-run mode", async () => {
    await init({ dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("source.ts"));
  });

  it("should create directories with mkdir recursive", async () => {
    await init({});

    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it("should log success message", async () => {
    await init({});

    expect(Logger.std.info).toHaveBeenCalledWith(expect.stringContaining("Hermes"));
  });
});
