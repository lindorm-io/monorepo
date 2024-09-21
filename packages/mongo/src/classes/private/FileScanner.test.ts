import { join } from "path";
import { TestFileOne } from "../../__fixtures__/files/test-file-one";
import { TestFileTwo } from "../../__fixtures__/files/test-file-two";
import { TestFile } from "../../__fixtures__/test-file";
import { FileScanner } from "./FileScanner";

describe("FileScanner", () => {
  test("should return with array of file constructors", () => {
    expect(FileScanner.scan([TestFile, TestFileOne, TestFileTwo])).toEqual([
      { File: TestFile },
      { File: TestFileOne },
      { File: TestFileTwo },
    ]);
  });

  test("should return with array of file options objects", () => {
    expect(
      FileScanner.scan([
        { File: TestFile, validate: jest.fn() },
        { File: TestFileOne, validate: jest.fn() },
        { File: TestFileTwo, indexes: [] },
      ]),
    ).toEqual([
      { File: TestFile, validate: expect.any(Function) },
      { File: TestFileOne, validate: expect.any(Function) },
      { File: TestFileTwo, indexes: [] },
    ]);
  });

  test("should return with array of file paths", () => {
    expect(
      FileScanner.scan([join(__dirname, "..", "..", "__fixtures__", "files")]),
    ).toEqual([
      { File: TestFileOne, validate: expect.any(Function) },
      { File: TestFileTwo, indexes: expect.any(Array) },
    ]);
  });
});
