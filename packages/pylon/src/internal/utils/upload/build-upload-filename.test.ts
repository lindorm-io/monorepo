import { buildUploadFilename, isValidFilenameSegment } from "./build-upload-filename.js";
import { describe, expect, test } from "vitest";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const thrownBy = (fn: () => unknown): any => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected the call to throw");
};

describe("isValidFilenameSegment", () => {
  test.each([
    ["a plain filename", "photo.jpg", true],
    ["a server-generated name", "f_abcABC012.jpg", true],
    ["an empty string", "", false],
    ["a dotfile", ".hidden", false],
    ["current dir", ".", false],
    ["parent dir", "..", false],
    ["a separator", "gallery/photo.jpg", false],
    ["a NUL byte", "photo\0.jpg", false],
  ])("%s → %s", (_label, name, expected) => {
    expect(isValidFilenameSegment(name)).toBe(expected);
  });
});

describe("buildUploadFilename", () => {
  describe("random", () => {
    test("prefixes `f_` with 32 base62 chars and lowercases the extension", () => {
      expect(buildUploadFilename("random", "Photo.JPG")).toMatch(
        /^f_[A-Za-z0-9]{32}\.jpg$/,
      );
    });

    test("keeps no extension when the original filename has none", () => {
      expect(buildUploadFilename("random", "photo")).toMatch(/^f_[A-Za-z0-9]{32}$/);
    });

    test("handles a null original filename", () => {
      expect(buildUploadFilename("random", null)).toMatch(/^f_[A-Za-z0-9]{32}$/);
    });

    test("yields a fresh name on every call", () => {
      expect(buildUploadFilename("random", "a.txt")).not.toBe(
        buildUploadFilename("random", "a.txt"),
      );
    });
  });

  describe("uuid", () => {
    test("uses a UUID stem and lowercases the extension", () => {
      const name = buildUploadFilename("uuid", "Photo.PNG");
      expect(name.endsWith(".png")).toBe(true);
      expect(name.slice(0, -".png".length)).toMatch(UUID);
    });

    test("stem alone is a valid UUID when there is no extension", () => {
      expect(buildUploadFilename("uuid", "photo")).toMatch(UUID);
    });
  });

  describe("original", () => {
    test("keeps the client filename verbatim — never sanitizes", () => {
      expect(buildUploadFilename("original", "My Photo.JPG")).toBe("My Photo.JPG");
    });

    test.each([
      ["a dotfile", ".env"],
      ["a separator", "sub/dir.jpg"],
      ["parent dir", ".."],
      ["an empty name", ""],
    ])("rejects %s as upload_invalid_filename (400)", (_label, name) => {
      expect(thrownBy(() => buildUploadFilename("original", name))).toMatchObject({
        status: 400,
        code: "upload_invalid_filename",
        type: "urn:lindorm:pylon:error:upload_invalid_filename",
      });
    });

    test("rejects a null original filename", () => {
      expect(thrownBy(() => buildUploadFilename("original", null))).toMatchObject({
        code: "upload_invalid_filename",
      });
    });
  });
});
