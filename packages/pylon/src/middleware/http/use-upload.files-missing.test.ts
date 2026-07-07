import request from "supertest";
import {
  createUploadServer,
  makeUploadRoot,
  type UploadTestServer,
} from "../../__fixtures__/upload-helpers/http-server.js";
import { useUpload } from "./use-upload.js";
import { afterEach, describe, expect, test, vi } from "vitest";

let server: UploadTestServer | undefined;

afterEach(async () => {
  if (server) await server.close();
  server = undefined;
});

const url = (): string => `http://127.0.0.1:${server!.port}`;

describe("useUpload upload_files_missing", () => {
  test("non-multipart POST → 400 upload_files_missing", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root }));

    const res = await request(url()).post("/upload/pics").send({ not: "multipart" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("upload_files_missing");
    expect(res.body.error.type).toBe("urn:lindorm:pylon:error:upload_files_missing");
  });

  test("multipart POST with zero files → 400 upload_files_missing", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(useUpload({ root }));

    const res = await request(url())
      .post("/upload/pics")
      .field("caption", "no file attached");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("upload_files_missing");
  });

  test("the error details point at the parseBody multipart config", async () => {
    const root = await makeUploadRoot();

    // `details` is not serialized on the wire, so assert it on the thrown error
    // by driving the middleware directly with no files present.
    const ctx: any = { method: "POST", params: { path: "pics" }, request: {} };

    let thrown: any;
    try {
      await useUpload({ root })(ctx, vi.fn());
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toMatchObject({
      status: 400,
      code: "upload_files_missing",
    });
    expect(thrown.details).toContain("parseBody");
    expect(thrown.details).toContain("multipart");
    expect(thrown.details).toContain("formidable");
  });
});
