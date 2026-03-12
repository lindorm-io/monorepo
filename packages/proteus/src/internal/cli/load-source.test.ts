import { loadSource } from "./load-source";
import { existsSync } from "fs";
import { Scanner } from "@lindorm/scanner";

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
}));

jest.mock("@lindorm/scanner");

const PROTEUS_SOURCE_BRAND = Symbol.for("ProteusSource");

const makeSource = () => {
  const source = { connect: jest.fn(), ping: jest.fn(), disconnect: jest.fn() };
  const ctor = function () {} as any;
  ctor[PROTEUS_SOURCE_BRAND] = true;
  Object.setPrototypeOf(source, { constructor: ctor });
  return source;
};

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const MockScanner = Scanner as jest.MockedClass<typeof Scanner>;

describe("loadSource", () => {
  let mockImport: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockImport = jest.fn();
    MockScanner.mockImplementation(() => ({ import: mockImport }) as any);
  });

  it("should throw when file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await expect(loadSource("/missing/file.ts")).rejects.toThrow("Source file not found");
  });

  it("should throw when no ProteusSource found in exports", async () => {
    mockImport.mockResolvedValue({ foo: "bar", baz: 42 });

    await expect(loadSource("/path/to/source.ts")).rejects.toThrow(
      "No ProteusSource instance found",
    );
  });

  it("should throw when multiple ProteusSource found without exportName", async () => {
    mockImport.mockResolvedValue({
      source1: makeSource(),
      source2: makeSource(),
    });

    await expect(loadSource("/path/to/source.ts")).rejects.toThrow(
      "Multiple ProteusSource instances found",
    );
  });

  it("should return the single ProteusSource instance", async () => {
    const source = makeSource();
    mockImport.mockResolvedValue({ mySource: source });

    const result = await loadSource("/path/to/source.ts");

    expect(result).toBe(source);
  });

  it("should select by exportName", async () => {
    const source1 = makeSource();
    const source2 = makeSource();
    mockImport.mockResolvedValue({ source1, source2 });

    const result = await loadSource("/path/to/source.ts", "source2");

    expect(result).toBe(source2);
  });

  it("should throw when exportName does not match a ProteusSource", async () => {
    const source = makeSource();
    mockImport.mockResolvedValue({ mySource: source });

    await expect(loadSource("/path/to/source.ts", "wrongName")).rejects.toThrow(
      'Export "wrongName" is not a ProteusSource instance',
    );
  });

  it("should resolve relative paths from cwd", async () => {
    const source = makeSource();
    mockImport.mockResolvedValue({ source });

    await loadSource("./relative/source.ts");

    expect(mockExistsSync).toHaveBeenCalledWith(
      expect.stringContaining("relative/source.ts"),
    );
  });
});
