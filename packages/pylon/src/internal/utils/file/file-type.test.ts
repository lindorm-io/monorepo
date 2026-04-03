import { fileType } from "./file-type";

describe("fileType", () => {
  test("should return extension for a simple file path", async () => {
    await expect(fileType("/some/path/file.ts")).resolves.toBe(".ts");
  });

  test("should return extension for js file", async () => {
    await expect(fileType("/some/path/file.js")).resolves.toBe(".js");
  });

  test("should return extension for file with multiple dots", async () => {
    await expect(fileType("/some/path/file.test.ts")).resolves.toBe(".ts");
  });

  test("should return empty string for file without extension", async () => {
    await expect(fileType("/some/path/Makefile")).resolves.toBe("");
  });

  test("should return the secondary extension when ext is provided", async () => {
    await expect(fileType("/some/path/file.test.ts", ".ts")).resolves.toBe(".test");
  });

  test("should return empty string when ext matches the only extension", async () => {
    await expect(fileType("/some/path/file.ts", ".ts")).resolves.toBe("");
  });

  test("should return original extension when ext does not match", async () => {
    await expect(fileType("/some/path/file.ts", ".js")).resolves.toBe(".ts");
  });
});
