import { readdir } from "node:fs/promises";
import { join } from "path";
import request from "supertest";
import {
  createUploadServer,
  makeUploadRoot,
  writeSizedFile,
  type UploadTestServer,
} from "../../__fixtures__/upload-helpers/http-server.js";
import { useUpload } from "./use-upload.js";
import { afterEach, describe, expect, test } from "vitest";

const fixture = join(__dirname, "..", "..", "__fixtures__", "upload.txt");

let server: UploadTestServer | undefined;

afterEach(async () => {
  if (server) await server.close();
  server = undefined;
});

const url = (): string => `http://127.0.0.1:${server!.port}`;

// Assert a subdirectory was never created (validation failed before any write).
const expectNoSubdir = async (root: string, subdir: string): Promise<void> => {
  await expect(readdir(join(root, subdir))).rejects.toMatchObject({ code: "ENOENT" });
  // Belt-and-braces: no dot-prefixed temp anywhere under the mount root.
  const rootEntries = await readdir(root);
  expect(rootEntries.filter((e) => e.startsWith(".upload-"))).toEqual([]);
};

describe("useUpload validation", () => {
  describe("extension allowlist (case-insensitive)", () => {
    test("accepts an allowed extension regardless of case", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, extensions: [".jpg"] }));

      const res = await request(url())
        .post("/upload/pics")
        .attach("file", fixture, { filename: "photo.JPG" });

      expect(res.status).toBe(201);
    });

    test("rejects a disallowed extension → 400 upload_invalid_extension", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, extensions: [".jpg"] }));

      const res = await request(url())
        .post("/upload/pics")
        .attach("file", fixture, { filename: "photo.gif" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("upload_invalid_extension");
      await expectNoSubdir(root, "pics");
    });
  });

  describe("mime allowlist", () => {
    test("accepts an allowed mime type", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, mimeTypes: ["text/plain"] }));

      const res = await request(url())
        .post("/upload/pics")
        .attach("file", fixture, { contentType: "text/plain" });

      expect(res.status).toBe(201);
    });

    test("rejects a disallowed mime type → 400 upload_invalid_mime_type", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, mimeTypes: ["text/plain"] }));

      const res = await request(url())
        .post("/upload/pics")
        .attach("file", fixture, { contentType: "image/png" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("upload_invalid_mime_type");
      await expectNoSubdir(root, "pics");
    });
  });

  describe("maxSize boundary", () => {
    test("a file exactly at the limit passes", async () => {
      const root = await makeUploadRoot();
      const scratch = await makeUploadRoot();
      const atLimit = await writeSizedFile(scratch, "at.bin", 1024);
      server = await createUploadServer(useUpload({ root, maxSize: 1024 }));

      const res = await request(url()).post("/upload/pics").attach("file", atLimit);

      expect(res.status).toBe(201);
      expect(res.body.files[0].size).toBe(1024);
    });

    test("a file one byte over the limit → 400 upload_file_too_large", async () => {
      const root = await makeUploadRoot();
      const scratch = await makeUploadRoot();
      const over = await writeSizedFile(scratch, "over.bin", 1025);
      server = await createUploadServer(useUpload({ root, maxSize: 1024 }));

      const res = await request(url()).post("/upload/pics").attach("file", over);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("upload_file_too_large");
      // Error bodies are set after the response-body middleware's snake-casing
      // pass, so `error.data` stays camelCase on the wire (unlike the success
      // body's snake_cased `files`).
      expect(res.body.error.data).toMatchObject({ size: 1025, maxSize: 1024 });
      await expectNoSubdir(root, "pics");
    });
  });

  describe("maxFiles", () => {
    test("at the limit passes", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, maxFiles: 2 }));

      const res = await request(url())
        .post("/upload/pics")
        .attach("a", fixture)
        .attach("b", fixture);

      expect(res.status).toBe(201);
      expect(res.body.files).toHaveLength(2);
    });

    test("over the limit → 400 upload_too_many_files", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, maxFiles: 2 }));

      const res = await request(url())
        .post("/upload/pics")
        .attach("a", fixture)
        .attach("b", fixture)
        .attach("c", fixture);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("upload_too_many_files");
      await expectNoSubdir(root, "pics");
    });
  });

  test("multi-file POST where ONE file fails validation persists NOTHING", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root, extensions: [".txt"] }));

    const res = await request(url())
      .post("/upload/pics")
      .attach("good", fixture, { filename: "ok.txt" })
      .attach("bad", fixture, { filename: "nope.gif" });

    // All files are validated before any is persisted, so one bad file rejects
    // the whole request and leaves nothing on disk.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("upload_invalid_extension");
    await expectNoSubdir(root, "pics");
  });
});
