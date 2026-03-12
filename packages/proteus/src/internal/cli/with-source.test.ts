import { withSource, withSourceConfig } from "./with-source";
import { loadSource } from "./load-source";
import { Logger } from "@lindorm/logger";

jest.mock("./load-source");

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

const mockLoadSource = loadSource as jest.MockedFunction<typeof loadSource>;

const makeSource = (driverType = "postgres") => ({
  driverType,
  namespace: "test",
  migrationsTable: undefined,
  getEntityMetadata: jest.fn().mockReturnValue([]),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  client: jest.fn(),
  log: { child: jest.fn().mockReturnValue({ debug: jest.fn() }) },
});

describe("withSource", () => {
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExit = jest.spyOn(process, "exit").mockImplementation((() => {}) as any);

    const source = makeSource();
    mockLoadSource.mockResolvedValue(source as any);
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  it("should call loadSource with source path and export name", async () => {
    await withSource(
      { source: "/path/to/source.ts", export: "mySource" },
      async () => {},
    );

    expect(mockLoadSource).toHaveBeenCalledWith("/path/to/source.ts", "mySource");
  });

  it("should call fn with context containing source", async () => {
    const fn = jest.fn().mockResolvedValue(undefined);

    await withSource({ source: "/path/to/source.ts" }, fn);

    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.anything(),
      }),
    );
  });

  it("should connect to source", async () => {
    const source = makeSource();
    mockLoadSource.mockResolvedValue(source as any);

    await withSource({ source: "/path/to/source.ts" }, async () => {});

    expect(source.connect).toHaveBeenCalled();
  });

  it("should disconnect from source after fn completes", async () => {
    const source = makeSource();
    mockLoadSource.mockResolvedValue(source as any);

    await withSource({ source: "/path/to/source.ts" }, async () => {});

    expect(source.disconnect).toHaveBeenCalled();
  });

  it("should disconnect from source even if fn throws", async () => {
    const source = makeSource();
    mockLoadSource.mockResolvedValue(source as any);

    await withSource({ source: "/path/to/source.ts" }, async () => {
      throw new Error("fn error");
    });

    expect(source.disconnect).toHaveBeenCalled();
  });

  it("should call Logger.std.error and exit(1) when fn throws", async () => {
    const err = new Error("fn error");

    await withSource({ source: "/path/to/source.ts" }, async () => {
      throw err;
    });

    expect(Logger.std.error).toHaveBeenCalledWith("fn error");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should work with any driver type", async () => {
    const fn = jest.fn().mockResolvedValue(undefined);

    for (const driverType of ["postgres", "mysql", "sqlite", "memory", "redis"]) {
      jest.clearAllMocks();
      const source = makeSource(driverType);
      mockLoadSource.mockResolvedValue(source as any);

      await withSource({ source: "/path/to/source.ts" }, fn);

      expect(fn).toHaveBeenCalledWith(
        expect.objectContaining({ source: expect.anything() }),
      );
      expect(source.connect).toHaveBeenCalled();
    }
  });
});

describe("withSourceConfig", () => {
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExit = jest.spyOn(process, "exit").mockImplementation((() => {}) as any);

    const source = makeSource();
    mockLoadSource.mockResolvedValue(source as any);
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  it("should call fn with source", async () => {
    const fn = jest.fn().mockResolvedValue(undefined);

    await withSourceConfig({ source: "/path/to/source.ts" }, fn);

    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.anything(),
      }),
    );
  });

  it("should call loadSource with source path and export name", async () => {
    await withSourceConfig(
      { source: "/path/to/source.ts", export: "myExport" },
      async () => {},
    );

    expect(mockLoadSource).toHaveBeenCalledWith("/path/to/source.ts", "myExport");
  });

  it("should call Logger.std.error and exit(1) when fn throws", async () => {
    const err = new Error("failure");

    await withSourceConfig({ source: "/path/to/source.ts" }, async () => {
      throw err;
    });

    expect(Logger.std.error).toHaveBeenCalledWith("failure");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should call Logger.std.error and exit(1) when loadSource throws", async () => {
    const err = new Error("source load failure");
    mockLoadSource.mockRejectedValue(err);

    await withSourceConfig({ source: "/path/to/source.ts" }, async () => {});

    expect(Logger.std.error).toHaveBeenCalledWith("source load failure");
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
