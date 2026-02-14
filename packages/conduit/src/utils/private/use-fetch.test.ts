// Polyfill required to override fetch (undici instead of http) when using nock
const fetch = require("node-fetch");
global.fetch = fetch;

import nock from "nock";
import { useFetch } from "./use-fetch";

describe("useFetch", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test("should resolve delete", async () => {
    nock("https://test.lindorm.io").delete("/").reply(204);

    await expect(
      useFetch("https://test.lindorm.io", { method: "delete" }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve get", async () => {
    nock("https://test.lindorm.io").get("/").reply(204);

    await expect(useFetch("https://test.lindorm.io", { method: "get" })).resolves.toEqual(
      expect.objectContaining({ status: 204 }),
    );
  });

  test("should resolve get with text", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(200, "hello", { "content-type": "text/plain" });

    await expect(useFetch("https://test.lindorm.io", { method: "get" })).resolves.toEqual(
      expect.objectContaining({ status: 200, data: "hello" }),
    );
  });

  test("should resolve get with json", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(200, { json: "hello" }, { "content-type": "application/json" });

    await expect(useFetch("https://test.lindorm.io", { method: "get" })).resolves.toEqual(
      expect.objectContaining({ status: 200, data: { json: "hello" } }),
    );
  });

  test("should resolve get with buffer", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(200, Buffer.from("hello"), { "content-type": "image/jpeg" });

    await expect(
      useFetch(
        "https://test.lindorm.io",
        { method: "get" },
        { config: { responseType: "arraybuffer" } },
      ),
    ).resolves.toEqual(
      expect.objectContaining({ status: 200, data: Buffer.from("hello") }),
    );
  });

  test("should resolve get with blob", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(200, Buffer.from("hello"), { "content-type": "image/jpeg" });

    await expect(
      useFetch(
        "https://test.lindorm.io",
        { method: "get" },
        { config: { responseType: "blob" } },
      ),
    ).resolves.toEqual(
      expect.objectContaining({ status: 200, data: expect.any(Object) }),
    );
  });

  test("should resolve head", async () => {
    nock("https://test.lindorm.io").head("/").reply(204);

    await expect(
      useFetch("https://test.lindorm.io", { method: "head" }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve options", async () => {
    nock("https://test.lindorm.io").options("/").reply(204);

    await expect(
      useFetch("https://test.lindorm.io", { method: "options" }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve patch", async () => {
    nock("https://test.lindorm.io").patch("/").reply(204);

    await expect(
      useFetch("https://test.lindorm.io", { method: "patch" }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve post", async () => {
    nock("https://test.lindorm.io").post("/").reply(204);

    await expect(
      useFetch("https://test.lindorm.io", { method: "post" }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve put", async () => {
    nock("https://test.lindorm.io").put("/").reply(204);

    await expect(useFetch("https://test.lindorm.io", { method: "put" })).resolves.toEqual(
      expect.objectContaining({ status: 204 }),
    );
  });

  test("should return response body when stream option is true", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(200, "streaming data", { "content-type": "text/plain" });

    const result = await useFetch(
      "https://test.lindorm.io",
      { method: "get" },
      { stream: true },
    );

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  });

  test("should handle network error (fetch throws TypeError)", async () => {
    nock("https://test.lindorm.io").get("/").replyWithError({
      message: "Network error",
      code: "ECONNREFUSED",
    });

    await expect(
      useFetch("https://test.lindorm.io", { method: "get" }),
    ).rejects.toThrow();
  });

  test("should handle response with no content-type header", async () => {
    nock("https://test.lindorm.io").get("/").reply(200, "plain response");

    await expect(useFetch("https://test.lindorm.io", { method: "get" })).resolves.toEqual(
      expect.objectContaining({ status: 200, data: undefined }),
    );
  });

  test("should handle non-ok response (!response.ok) with json parsing", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(400, { error: "Bad Request" }, { "content-type": "application/json" });

    await expect(
      useFetch("https://test.lindorm.io", { method: "get" }),
    ).rejects.toThrow();
  });

  test("should handle non-ok response with text parsing", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(500, "Internal Server Error", { "content-type": "text/plain" });

    await expect(
      useFetch("https://test.lindorm.io", { method: "get" }),
    ).rejects.toThrow();
  });
});
