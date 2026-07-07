import { readFile, readdir } from "node:fs/promises";
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

let server: UploadTestServer | undefined;

afterEach(async () => {
  if (server) await server.close();
  server = undefined;
});

const url = (): string => `http://127.0.0.1:${server!.port}`;

describe("useUpload multiple files", () => {
  test("all files in one POST persist and appear in order", async () => {
    const root = await makeUploadRoot();
    const scratch = await makeUploadRoot();
    const one = await writeContentFile(scratch, "one.txt", "ONE");
    const two = await writeContentFile(scratch, "two.txt", "TWO");
    const three = await writeContentFile(scratch, "three.txt", "THREE");
    server = await createUploadServer(useUpload({ root, naming: "original" }));

    const res = await request(url())
      .post("/upload/batch")
      .attach("a", one, { filename: "one.txt" })
      .attach("b", two, { filename: "two.txt" })
      .attach("c", three, { filename: "three.txt" });

    expect(res.status).toBe(201);
    expect(res.body.files).toHaveLength(3);

    // Response order is stable and matches the attach order.
    expect(res.body.files.map((f: any) => f.original_name)).toEqual([
      "one.txt",
      "two.txt",
      "three.txt",
    ]);

    // Every file landed on disk with its own content.
    expect((await readdir(join(root, "batch"))).sort()).toEqual([
      "one.txt",
      "three.txt",
      "two.txt",
    ]);
    expect(await readFile(join(root, "batch", "one.txt"), "utf8")).toBe("ONE");
    expect(await readFile(join(root, "batch", "two.txt"), "utf8")).toBe("TWO");
    expect(await readFile(join(root, "batch", "three.txt"), "utf8")).toBe("THREE");

    // The context slot mirrors the response order.
    expect((server.captured.files ?? []).map((f) => f.originalName)).toEqual([
      "one.txt",
      "two.txt",
      "three.txt",
    ]);
  });

  test("duplicate names within one request conflict before anything persists", async () => {
    const root = await makeUploadRoot();
    const scratch = await makeUploadRoot();
    const one = await writeContentFile(scratch, "one.txt", "FIRST");
    const two = await writeContentFile(scratch, "two.txt", "SECOND");
    server = await createUploadServer(useUpload({ root, naming: "original" }));

    const res = await request(url())
      .post("/upload/batch")
      .attach("a", one, { filename: "same.txt" })
      .attach("b", two, { filename: "same.txt" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("upload_conflict");

    // Nothing persisted — the second file must not silently replace the first.
    await expect(readdir(join(root, "batch"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test("duplicate names within one request are allowed with overwrite (last wins)", async () => {
    const root = await makeUploadRoot();
    const scratch = await makeUploadRoot();
    const one = await writeContentFile(scratch, "one.txt", "FIRST");
    const two = await writeContentFile(scratch, "two.txt", "SECOND");
    server = await createUploadServer(
      useUpload({ root, naming: "original", overwrite: true }),
    );

    const res = await request(url())
      .post("/upload/batch")
      .attach("a", one, { filename: "same.txt" })
      .attach("b", two, { filename: "same.txt" });

    expect(res.status).toBe(201);
    expect(await readdir(join(root, "batch"))).toEqual(["same.txt"]);
    expect(await readFile(join(root, "batch", "same.txt"), "utf8")).toBe("SECOND");
  });
});
