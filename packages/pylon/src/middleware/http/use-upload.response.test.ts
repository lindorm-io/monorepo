import request from "supertest";
import { join } from "path";
import {
  createUploadServer,
  makeUploadRoot,
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

describe("useUpload response", () => {
  test("201 body is { files: [...] } with snake_cased keys on the wire", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root }));

    const res = await request(url())
      .post("/upload/gallery")
      .attach("file", fixture, { filename: "upload.txt", contentType: "text/plain" });

    expect(res.status).toBe(201);
    const item = res.body.files[0];

    // Wire keys are snake_cased (mime_type / original_name), never camelCase.
    expect(Object.keys(item).sort()).toEqual([
      "mime_type",
      "name",
      "original_name",
      "path",
      "size",
    ]);

    // Stabilise the generated name for a snapshot of the stable subset.
    expect({
      ...item,
      name: "<name>",
      path: item.path.replace(item.name, "<name>"),
    }).toMatchSnapshot();
  });

  describe("response path", () => {
    test("with a prefix set → a serving URL with a leading slash, no double slashes", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, prefix: "/assets" }));

      const res = await request(url())
        .post("/upload/gallery/2026")
        .attach("file", fixture, { filename: "photo.jpg" });

      const { name, path } = res.body.files[0];
      expect(path).toBe(`/assets/gallery/2026/${name}`);
      expect(path).not.toContain("//");
    });

    test("with a prefix set and no subdir → prefix joined to name, no double slash", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root, prefix: "/assets" }));

      const res = await request(url())
        .post("/upload")
        .attach("file", fixture, { filename: "photo.jpg" });

      const { name, path } = res.body.files[0];
      expect(path).toBe(`/assets/${name}`);
      expect(path).not.toContain("//");
    });

    test("without a prefix → root-relative, no leading slash", async () => {
      const root = await makeUploadRoot();
      server = await createUploadServer(useUpload({ root }));

      const res = await request(url())
        .post("/upload/gallery/2026")
        .attach("file", fixture, { filename: "photo.jpg" });

      const { name, path } = res.body.files[0];
      expect(path).toBe(`gallery/2026/${name}`);
      expect(path.startsWith("/")).toBe(false);
    });
  });

  test("ctx.files is populated as IPylonFileUpload", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root }));

    const res = await request(url())
      .post("/upload/gallery")
      .attach("file", fixture, { filename: "upload.txt", contentType: "text/plain" });

    const [file] = server.captured.files ?? [];
    const wireName = res.body.files[0].name;

    // The context slot carries the in-code IPylonFileUpload shape (camelCase,
    // a real Date), distinct from the snake-cased wire body.
    expect(file).toMatchObject({
      filename: wireName,
      length: 9,
      mimeType: "text/plain",
      originalName: "upload.txt",
    });
    expect(file.uploadDate).toBeInstanceOf(Date);
    expect(Object.keys(file).sort()).toEqual([
      "filename",
      "length",
      "mimeType",
      "originalName",
      "uploadDate",
    ]);
  });
});
