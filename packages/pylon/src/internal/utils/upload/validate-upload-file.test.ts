import type { File } from "formidable";
import {
  validateUploadFile,
  type UploadValidationOptions,
} from "./validate-upload-file.js";
import { describe, expect, test } from "vitest";

const file = (over: Partial<File> = {}): File =>
  ({ size: 10, mimetype: "image/jpeg", ...over }) as File;

const opts = (over: Partial<UploadValidationOptions> = {}): UploadValidationOptions => ({
  extensions: null,
  mimeTypes: null,
  maxSize: null,
  ...over,
});

const thrownBy = (fn: () => unknown): any => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected the call to throw");
};

describe("validateUploadFile", () => {
  test("passes when no allowlist or limit is set", () => {
    expect(() => validateUploadFile(file(), opts(), "photo.jpg")).not.toThrow();
  });

  describe("extension allowlist", () => {
    test("accepts an allowed extension", () => {
      expect(() =>
        validateUploadFile(file(), opts({ extensions: [".jpg"] }), "photo.jpg"),
      ).not.toThrow();
    });

    test("is case-insensitive on the checked name", () => {
      expect(() =>
        validateUploadFile(file(), opts({ extensions: [".jpg"] }), "PHOTO.JPG"),
      ).not.toThrow();
    });

    test("rejects a disallowed extension as upload_invalid_extension (400)", () => {
      const err = thrownBy(() =>
        validateUploadFile(file(), opts({ extensions: [".jpg", ".png"] }), "photo.gif"),
      );
      expect(err).toMatchObject({
        status: 400,
        code: "upload_invalid_extension",
        type: "urn:lindorm:pylon:error:upload_invalid_extension",
        data: { extension: ".gif", allowed: [".jpg", ".png"] },
      });
    });
  });

  describe("mime allowlist", () => {
    test("accepts an allowed mime type", () => {
      expect(() =>
        validateUploadFile(
          file({ mimetype: "image/png" }),
          opts({ mimeTypes: ["image/png"] }),
          "photo.png",
        ),
      ).not.toThrow();
    });

    test("rejects a disallowed mime type as upload_invalid_mime_type (400)", () => {
      const err = thrownBy(() =>
        validateUploadFile(
          file({ mimetype: "image/gif" }),
          opts({ mimeTypes: ["image/png"] }),
          "photo.gif",
        ),
      );
      expect(err).toMatchObject({
        status: 400,
        code: "upload_invalid_mime_type",
        type: "urn:lindorm:pylon:error:upload_invalid_mime_type",
        data: { mimeType: "image/gif", allowed: ["image/png"] },
      });
    });

    test("rejects a missing mime type when an allowlist is active", () => {
      const err = thrownBy(() =>
        validateUploadFile(
          file({ mimetype: null }),
          opts({ mimeTypes: ["image/png"] }),
          "photo.png",
        ),
      );
      expect(err).toMatchObject({ code: "upload_invalid_mime_type" });
    });
  });

  describe("maxSize boundary", () => {
    test("accepts a file exactly at the limit", () => {
      expect(() =>
        validateUploadFile(file({ size: 1024 }), opts({ maxSize: 1024 }), "a.jpg"),
      ).not.toThrow();
    });

    test("rejects a file one byte over the limit as upload_file_too_large (400)", () => {
      const err = thrownBy(() =>
        validateUploadFile(file({ size: 1025 }), opts({ maxSize: 1024 }), "a.jpg"),
      );
      expect(err).toMatchObject({
        status: 400,
        code: "upload_file_too_large",
        type: "urn:lindorm:pylon:error:upload_file_too_large",
        data: { size: 1025, maxSize: 1024 },
      });
    });
  });
});
