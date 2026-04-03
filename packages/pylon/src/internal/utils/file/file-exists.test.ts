import { access } from "fs/promises";
import { fileExists } from "./file-exists";

jest.mock("fs/promises");

const mockAccess = access as jest.MockedFunction<typeof access>;

describe("fileExists", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return true when file exists", async () => {
    mockAccess.mockResolvedValue(undefined);

    await expect(fileExists("/some/path/file.ts")).resolves.toBe(true);
    expect(mockAccess).toHaveBeenCalledWith("/some/path/file.ts");
  });

  test("should return false when file does not exist", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    await expect(fileExists("/some/missing/file.ts")).resolves.toBe(false);
    expect(mockAccess).toHaveBeenCalledWith("/some/missing/file.ts");
  });

  test("should return false on permission errors", async () => {
    mockAccess.mockRejectedValue(new Error("EACCES"));

    await expect(fileExists("/some/protected/file.ts")).resolves.toBe(false);
  });
});
