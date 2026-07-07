import { readdir, readFile } from "node:fs/promises";
import { join } from "path";
import request from "supertest";
import {
  createUploadServer,
  makeUploadRoot,
  type UploadTestServer,
} from "../../__fixtures__/upload-helpers/http-server.js";
import { useUpload } from "./use-upload.js";
import { afterEach, describe, expect, test, vi } from "vitest";

const fixture = join(__dirname, "..", "..", "__fixtures__", "upload.txt");

let server: UploadTestServer | undefined;

afterEach(async () => {
  if (server) await server.close();
  server = undefined;
});

const url = (): string => `http://127.0.0.1:${server!.port}`;

// Drive the middleware directly: koa-router has already percent-decoded the
// splat, so a decoded `..`/NUL/dotfile reaching the middleware is exactly what a
// crafted request looks like once routing has run. A file must be present, since
// the missing-files check runs before path resolution.
const driveWithSplat = (root: string, path: string): Promise<void> => {
  const ctx: any = {
    method: "POST",
    params: { path },
    request: {
      files: {
        file: [
          {
            filepath: fixture,
            originalFilename: "x.txt",
            mimetype: "text/plain",
            size: 9,
          },
        ],
      },
    },
  };
  return useUpload({ root })(ctx, vi.fn());
};

describe("useUpload subdirectories", () => {
  test("POST to a nested splat creates directories recursively", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root }));

    const res = await request(url())
      .post("/upload/gallery/2026/spring")
      .attach("file", fixture);

    expect(res.status).toBe(201);

    const { name } = res.body.files[0];
    expect(res.body.files[0].path).toBe(`gallery/2026/spring/${name}`);
    expect(await readFile(join(root, "gallery", "2026", "spring", name), "utf8")).toBe(
      "testfile\n",
    );
  });

  test("POST to the mount root lands the file directly under root", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root }));

    const res = await request(url()).post("/upload").attach("file", fixture);

    expect(res.status).toBe(201);
    const { name } = res.body.files[0];
    // No subdirectory: path is just the name (no leading slash, no prefix set).
    expect(res.body.files[0].path).toBe(name);
    expect(await readdir(root)).toContain(name);
  });

  test.each([
    ["parent traversal", "../secret"],
    ["nested traversal", "gallery/../../etc"],
    ["NUL byte", "gallery/\0/x"],
    ["dot-prefixed segment", "gallery/.hidden"],
    ["current-dir segment", "gallery/./x"],
  ])("rejects %s splat as upload_invalid_path (400)", async (_label, path) => {
    const root = await makeUploadRoot();

    await expect(driveWithSplat(root, path)).rejects.toMatchObject({
      status: 400,
      code: "upload_invalid_path",
      type: "urn:lindorm:pylon:error:upload_invalid_path",
    });

    // A rejected splat leaves nothing on disk.
    expect(await readdir(root)).toEqual([]);
  });
});
