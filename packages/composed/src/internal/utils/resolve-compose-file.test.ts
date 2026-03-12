import { existsSync } from "fs";
import { resolve } from "path";
import { resolveComposeFile } from "./resolve-compose-file";

jest.mock("fs", () => ({
  existsSync: jest.fn(),
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe("resolveComposeFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return resolved path when explicit file exists", () => {
    mockExistsSync.mockReturnValue(true);

    const result = resolveComposeFile("docker-compose.yml");

    expect(result).toBe(resolve("docker-compose.yml"));
  });

  test("should throw when explicit file does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    expect(() => resolveComposeFile("missing.yml")).toThrow(
      `Compose file not found: ${resolve("missing.yml")}`,
    );
  });

  test("should auto-detect docker-compose.yml", () => {
    mockExistsSync.mockImplementation((p) => p === resolve("docker-compose.yml"));

    const result = resolveComposeFile("");

    expect(result).toBe(resolve("docker-compose.yml"));
  });

  test("should auto-detect docker-compose.yaml when yml not found", () => {
    mockExistsSync.mockImplementation((p) => p === resolve("docker-compose.yaml"));

    const result = resolveComposeFile("");

    expect(result).toBe(resolve("docker-compose.yaml"));
  });

  test("should throw when neither yml nor yaml exists", () => {
    mockExistsSync.mockReturnValue(false);

    expect(() => resolveComposeFile("")).toThrow(
      /Compose file not found: looked for docker-compose\.yml and docker-compose\.yaml in/,
    );
  });

  test("should check yml before yaml", () => {
    mockExistsSync.mockReturnValue(true);

    const result = resolveComposeFile("");

    expect(result).toBe(resolve("docker-compose.yml"));
    expect(mockExistsSync).toHaveBeenCalledTimes(1);
  });
});
