import { dbPing } from "./db-ping";
import { loadSource } from "../load-source";
import { Logger } from "@lindorm/logger";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
  type MockedFunction,
} from "vitest";

vi.mock("../load-source");

const mockLoadSource = loadSource as MockedFunction<typeof loadSource>;

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

const makeSource = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn().mockResolvedValue(undefined),
});

describe("dbPing", () => {
  let mockExit: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    mockLoadSource.mockResolvedValue(makeSource() as any);
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  it("should connect, ping, and log a success message", async () => {
    const source = makeSource();
    mockLoadSource.mockResolvedValue(source as any);

    await dbPing({ source: "/path/to/source.ts" });

    expect(source.connect).toHaveBeenCalled();
    expect(source.ping).toHaveBeenCalled();
    expect(Logger.std.info).toHaveBeenCalledWith(expect.stringContaining("Connected"));
  });

  it("should disconnect after a successful ping", async () => {
    const source = makeSource();
    mockLoadSource.mockResolvedValue(source as any);

    await dbPing({ source: "/path/to/source.ts" });

    expect(source.disconnect).toHaveBeenCalled();
  });

  it("should disconnect even if ping throws", async () => {
    const source = makeSource();
    source.ping.mockRejectedValue(new Error("ping failed"));
    mockLoadSource.mockResolvedValue(source as any);

    await dbPing({ source: "/path/to/source.ts" });

    expect(source.disconnect).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should log an error and exit(1) when connection fails", async () => {
    const source = makeSource();
    source.connect.mockRejectedValue(new Error("ECONNREFUSED"));
    mockLoadSource.mockResolvedValue(source as any);

    await dbPing({ source: "/path/to/source.ts" });

    expect(Logger.std.error).toHaveBeenCalledWith("ECONNREFUSED");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should call Logger.std.error for non-Error thrown values", async () => {
    const nonError = { code: "WEIRD" };
    mockLoadSource.mockRejectedValue(nonError);

    await dbPing({ source: "/path/to/source.ts" });

    expect(Logger.std.error).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should pass source path and export name to loadSource", async () => {
    await dbPing({ source: "/custom/source.ts", export: "mySource" });

    expect(mockLoadSource).toHaveBeenCalledWith("/custom/source.ts", "mySource");
  });

  it("should error when source file does not exist", async () => {
    mockLoadSource.mockRejectedValue(new Error("Source file not found: /nonexistent.ts"));

    await dbPing({ source: "/nonexistent.ts" });

    expect(Logger.std.error).toHaveBeenCalledWith(
      expect.stringContaining("Source file not found"),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should include elapsed time in success message", async () => {
    await dbPing({ source: "/path/to/source.ts" });

    const infoCall = (Logger.std.info as Mock).mock.calls[0][0] as string;
    expect(infoCall).toMatch(/\d+ms/);
  });
});
