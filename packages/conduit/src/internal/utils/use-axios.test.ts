import nock from "nock";
import { useAxios } from "./use-axios";

describe("useAxios", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test("should resolve delete", async () => {
    nock("https://test.lindorm.io").delete("/").reply(204);

    await expect(
      useAxios({ url: "https://test.lindorm.io", method: "delete" }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve get", async () => {
    nock("https://test.lindorm.io").get("/").reply(204);

    await expect(
      useAxios({
        url: "https://test.lindorm.io",
        method: "get",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve get with text", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(200, "hello", { "content-type": "text/plain" });

    await expect(
      useAxios({
        url: "https://test.lindorm.io",
        method: "get",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 200, data: "hello" }));
  });

  test("should resolve get with json", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(200, { json: "hello" }, { "content-type": "application/json" });

    await expect(
      useAxios({
        url: "https://test.lindorm.io",
        method: "get",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 200, data: { json: "hello" } }));
  });

  test("should resolve get with buffer", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(200, Buffer.from("hello"), { "content-type": "image/jpeg" });

    await expect(
      useAxios({
        url: "https://test.lindorm.io",
        method: "get",
        responseType: "arraybuffer",
      }),
    ).resolves.toEqual(
      expect.objectContaining({ status: 200, data: Buffer.from("hello") }),
    );
  });

  test("should resolve get with blob", async () => {
    nock("https://test.lindorm.io")
      .get("/")
      .reply(200, Buffer.from("hello"), { "content-type": "image/jpeg" });

    await expect(
      useAxios({ url: "https://test.lindorm.io", method: "get", responseType: "blob" }),
    ).resolves.toEqual(expect.objectContaining({ status: 200, data: "hello" }));
  });

  test("should resolve head", async () => {
    nock("https://test.lindorm.io").head("/").reply(204);

    await expect(
      useAxios({
        url: "https://test.lindorm.io",
        method: "head",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve options", async () => {
    nock("https://test.lindorm.io").options("/").reply(204);

    await expect(
      useAxios({
        url: "https://test.lindorm.io",
        method: "options",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve patch", async () => {
    nock("https://test.lindorm.io").patch("/").reply(204);

    await expect(
      useAxios({
        url: "https://test.lindorm.io",
        method: "patch",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve post", async () => {
    nock("https://test.lindorm.io").post("/").reply(204);

    await expect(
      useAxios({
        url: "https://test.lindorm.io",
        method: "post",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve put", async () => {
    nock("https://test.lindorm.io").put("/").reply(204);

    await expect(
      useAxios({
        url: "https://test.lindorm.io",
        method: "put",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });
});
