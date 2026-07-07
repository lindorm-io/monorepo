import { readFile } from "node:fs/promises";
import { join } from "path";
import request from "supertest";
import {
  createUploadServer,
  makeUploadRoot,
  writeContentFile,
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

describe("useUpload PUT", () => {
  test("creates a file at the exact target name → 201", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root }));

    const res = await request(url())
      .put("/upload/gallery/photo.txt")
      .attach("file", fixture);

    expect(res.status).toBe(201);
    expect(res.body.files[0].name).toBe("photo.txt");
    expect(res.body.files[0].path).toBe("gallery/photo.txt");
    expect(await readFile(join(root, "gallery", "photo.txt"), "utf8")).toBe("testfile\n");
  });

  test("existing target without overwrite → 409 and the original is untouched", async () => {
    const root = await makeUploadRoot();
    const scratch = await makeUploadRoot();
    const original = await writeContentFile(scratch, "a.txt", "ORIGINAL");
    const replacement = await writeContentFile(scratch, "b.txt", "REPLACEMENT");
    server = await createUploadServer(useUpload({ root }));

    const created = await request(url()).put("/upload/doc.txt").attach("file", original);
    expect(created.status).toBe(201);

    const conflict = await request(url())
      .put("/upload/doc.txt")
      .attach("file", replacement);

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("upload_conflict");
    expect(conflict.body.error.type).toBe("urn:lindorm:pylon:error:upload_conflict");
    // Client-visible error data never leaks an absolute disk path (paths live
    // in `debug`, which is not serialized on the wire).
    expect(conflict.body.error.data).toEqual({ name: "doc.txt" });
    expect(JSON.stringify(conflict.body)).not.toContain(root);
    // Byte-for-byte: the existing file was never overwritten.
    expect(await readFile(join(root, "doc.txt"), "utf8")).toBe("ORIGINAL");
  });

  test("existing target with overwrite:true → 200 and content replaced", async () => {
    const root = await makeUploadRoot();
    const scratch = await makeUploadRoot();
    const original = await writeContentFile(scratch, "a.txt", "ORIGINAL");
    const replacement = await writeContentFile(scratch, "b.txt", "REPLACEMENT");
    server = await createUploadServer(useUpload({ root, overwrite: true }));

    const created = await request(url()).put("/upload/doc.txt").attach("file", original);
    expect(created.status).toBe(201);

    const replaced = await request(url())
      .put("/upload/doc.txt")
      .attach("file", replacement);

    expect(replaced.status).toBe(200);
    expect(await readFile(join(root, "doc.txt"), "utf8")).toBe("REPLACEMENT");
  });

  test("empty splat (no target filename) → 400 upload_target_required", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root }));

    const res = await request(url()).put("/upload").attach("file", fixture);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("upload_target_required");
    expect(res.body.error.type).toBe("urn:lindorm:pylon:error:upload_target_required");
  });

  test("more than one file → 400 upload_single_file_required", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root }));

    const res = await request(url())
      .put("/upload/doc.txt")
      .attach("one", fixture)
      .attach("two", fixture);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("upload_single_file_required");
    expect(res.body.error.type).toBe(
      "urn:lindorm:pylon:error:upload_single_file_required",
    );
  });

  describe("extension allowlist applies to the TARGET name", () => {
    test("target with an allowed extension → 201", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, extensions: [".jpg"] }));

      const res = await request(url()).put("/upload/photo.jpg").attach("file", fixture);

      expect(res.status).toBe(201);
    });

    test("target with a disallowed extension → 400 upload_invalid_extension", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, extensions: [".jpg"] }));

      const res = await request(url()).put("/upload/photo.txt").attach("file", fixture);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("upload_invalid_extension");
      expect(res.body.error.data.extension).toBe(".txt");
    });

    test("invalid target filename (dotfile) → 400 upload_invalid_filename", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root }));

      const res = await request(url())
        .put("/upload/gallery/.secret")
        .attach("file", fixture);

      expect(res.status).toBe(400);
      // Intentional deviation from the splat rejection: an invalid TARGET
      // filename on PUT is upload_invalid_filename, not upload_invalid_path.
      expect(res.body.error.code).toBe("upload_invalid_filename");
      expect(res.body.error.type).toBe("urn:lindorm:pylon:error:upload_invalid_filename");
    });
  });
});
