import { join } from "path";
import { resolveUploadDirectory } from "./resolve-upload-directory.js";
import { describe, expect, test } from "vitest";

const root = join("/mnt", "assets");

// Run `fn`, returning whatever it throws (or failing if it does not throw).
const thrownBy = (fn: () => unknown): any => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected the call to throw");
};

describe("resolveUploadDirectory", () => {
  test("resolves a nested splat to an absolute directory under root", () => {
    expect(resolveUploadDirectory(root, "gallery/2026")).toBe(
      join(root, "gallery", "2026"),
    );
  });

  test("resolves an undefined splat to the mount root", () => {
    expect(resolveUploadDirectory(root, undefined)).toBe(root);
  });

  test("resolves an empty splat to the mount root", () => {
    expect(resolveUploadDirectory(root, "")).toBe(root);
  });

  test("resolves a single trailing slash as the directory itself", () => {
    expect(resolveUploadDirectory(root, "gallery/")).toBe(join(root, "gallery"));
  });

  // On a write surface an invalid path must surface as a 400 so the client
  // learns the target was rejected — never the static 404.
  test.each([
    ["parent traversal", "../secret"],
    ["nested traversal", "gallery/../../etc/passwd"],
    ["NUL byte", "gallery/\0/x"],
    ["dot-prefixed segment", "gallery/.hidden/x"],
    ["current-dir segment", "gallery/./x"],
    ["empty internal segment", "gallery//x"],
  ])("rejects %s as upload_invalid_path (400)", (_label, splat) => {
    expect(thrownBy(() => resolveUploadDirectory(root, splat))).toMatchObject({
      status: 400,
      code: "upload_invalid_path",
      type: "urn:lindorm:pylon:error:upload_invalid_path",
    });
  });

  test("the rejection carries no client-visible data (paths live in debug)", () => {
    const err = thrownBy(() => resolveUploadDirectory(root, "../secret"));

    // `data` is what reaches the client; disk paths must not be there.
    expect(err.data).toEqual({});
    expect(err.debug).toMatchObject({ root, splat: "../secret" });
  });
});
