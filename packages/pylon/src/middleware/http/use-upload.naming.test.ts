import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "path";
import request from "supertest";
import {
  createUploadServer,
  makeUploadRoot,
  type UploadTestServer,
} from "../../__fixtures__/upload-helpers/http-server.js";
import { useUpload } from "./use-upload.js";
import { afterEach, describe, expect, test } from "vitest";

const fixture = join(__dirname, "..", "..", "__fixtures__", "upload.txt");
const CONTENT = "testfile\n";

let server: UploadTestServer | undefined;

afterEach(async () => {
  if (server) await server.close();
  server = undefined;
});

const url = (): string => `http://127.0.0.1:${server!.port}`;

describe("useUpload naming", () => {
  test("random → f_<base62×32> keeping the lowercased original extension", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root, naming: "random" }));

    const res = await request(url())
      .post("/upload/pics")
      .attach("file", fixture, { filename: "Holiday.TXT" });

    expect(res.status).toBe(201);
    expect(res.body.files[0].name).toMatch(/^f_[A-Za-z0-9]{32}\.txt$/);
    expect(await readFile(join(root, "pics", res.body.files[0].name), "utf8")).toBe(
      CONTENT,
    );
  });

  test("uuid → a UUID name with the lowercased original extension", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root, naming: "uuid" }));

    const res = await request(url())
      .post("/upload/pics")
      .attach("file", fixture, { filename: "Holiday.TXT" });

    expect(res.status).toBe(201);
    expect(res.body.files[0].name).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.txt$/,
    );
  });

  describe("hash", () => {
    test("→ base64url sha-256 of the CONTENT (verified against an independent digest)", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, naming: "hash" }));

      const res = await request(url())
        .post("/upload/pics")
        .attach("file", fixture, { filename: "Holiday.txt" });

      const digest = createHash("sha256").update(CONTENT).digest("base64url");
      expect(res.status).toBe(201);
      expect(res.body.files[0].name).toBe(`${digest}.txt`);
      expect(await readFile(join(root, "pics", `${digest}.txt`), "utf8")).toBe(CONTENT);
    });

    test("dedupe: re-POST identical content → success, single file, not rewritten", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, naming: "hash" }));

      const first = await request(url())
        .post("/upload/pics")
        .attach("file", fixture, { filename: "a.txt" });
      const name = first.body.files[0].name;
      const path = join(root, "pics", name);
      const before = await stat(path);

      const second = await request(url())
        .post("/upload/pics")
        .attach("file", fixture, { filename: "b.txt" });
      const after = await stat(path);

      // Idempotent dedupe: the request succeeds and reports the same stored
      // entry, but the on-disk file is untouched (same inode, same mtime) …
      expect(second.status).toBe(201);
      expect(second.body.files[0].name).toBe(name);
      expect(after.ino).toBe(before.ino);
      expect(after.mtimeMs).toBe(before.mtimeMs);

      // … and there is exactly one file on disk.
      expect(await readdir(join(root, "pics"))).toEqual([name]);
    });
  });

  describe("original", () => {
    test("keeps the client filename verbatim — never sanitizes", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, naming: "original" }));

      const res = await request(url())
        .post("/upload/pics")
        .attach("file", fixture, { filename: "My Report.TXT" });

      expect(res.status).toBe(201);
      // Verbatim: casing and spaces preserved, no basename/lowercase mangling.
      expect(res.body.files[0].name).toBe("My Report.TXT");
      expect(await readFile(join(root, "pics", "My Report.TXT"), "utf8")).toBe(CONTENT);
    });

    test("rejects a dotfile original filename as upload_invalid_filename (400)", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, naming: "original" }));

      const res = await request(url())
        .post("/upload/pics")
        .attach("file", fixture, { filename: ".env" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("upload_invalid_filename");
      expect(res.body.error.type).toBe("urn:lindorm:pylon:error:upload_invalid_filename");
      // Nothing persisted for the rejected upload.
      await expect(readdir(join(root, "pics"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    });
  });
});
