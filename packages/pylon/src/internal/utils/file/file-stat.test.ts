import { ServerError } from "@lindorm/errors";
import { Stats } from "fs";
import { stat } from "fs/promises";
import { fileStat } from "./file-stat";

jest.mock("fs/promises");

const mockStat = stat as jest.MockedFunction<typeof stat>;

describe("fileStat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return stats for a valid file", async () => {
    const mockStats = { size: 1024, isFile: () => true } as unknown as Stats;
    mockStat.mockResolvedValue(mockStats);

    const result = await fileStat("/some/path/file.ts");

    expect(result).toBe(mockStats);
    expect(mockStat).toHaveBeenCalledWith("/some/path/file.ts");
  });

  test("should throw ServerError when stat fails", async () => {
    mockStat.mockRejectedValue(new Error("ENOENT: no such file"));

    await expect(fileStat("/missing/file.ts")).rejects.toThrow(ServerError);
    await expect(fileStat("/missing/file.ts")).rejects.toThrow(
      "Unable to find stat for file",
    );
  });
});
