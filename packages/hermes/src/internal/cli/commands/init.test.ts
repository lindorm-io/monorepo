import { resolve, join } from "path";
import { init } from "./init";

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

const defaultDir = resolve(process.cwd(), "./src/hermes");

describe("init", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
