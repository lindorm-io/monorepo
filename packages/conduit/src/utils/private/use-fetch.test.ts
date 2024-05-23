import fetchMock from "fetch-mock";
import { useFetch } from "./use-fetch";

describe("useFetch", () => {
  afterEach(() => {
    fetchMock.restore();
  });

  test("should resolve delete", async () => {
    fetchMock.mock("https://test.osprey.no", { status: 204 });

    await expect(
      useFetch("https://test.osprey.no", { method: "delete" }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve get", async () => {
    fetchMock.mock("https://test.osprey.no", { status: 204 });

    await expect(useFetch("https://test.osprey.no", { method: "get" })).resolves.toEqual(
      expect.objectContaining({ status: 204 }),
    );
  });

  test("should resolve get with text", async () => {
    fetchMock.mock("https://test.osprey.no", { status: 200, body: "hello" });

    await expect(useFetch("https://test.osprey.no", { method: "get" })).resolves.toEqual(
      expect.objectContaining({
        data: "hello",
        headers: {
          "content-length": "5",
          "content-type": "text/plain;charset=UTF-8",
        },
        status: 200,
        statusText: "OK",
      }),
    );
  });

  test("should resolve get with json", async () => {
    fetchMock.mock("https://test.osprey.no", { status: 200, body: { json: "hello" } });

    await expect(useFetch("https://test.osprey.no", { method: "get" })).resolves.toEqual(
      expect.objectContaining({
        data: { json: "hello" },
        headers: {
          "content-length": "16",
          "content-type": "application/json",
        },
        status: 200,
        statusText: "OK",
      }),
    );
  });

  test("should resolve head", async () => {
    fetchMock.mock("https://test.osprey.no", { status: 204 });

    await expect(useFetch("https://test.osprey.no", { method: "head" })).resolves.toEqual(
      expect.objectContaining({ status: 204 }),
    );

    fetchMock;
  });

  test("should resolve options", async () => {
    fetchMock.mock("https://test.osprey.no", { status: 204 });

    await expect(
      useFetch("https://test.osprey.no", { method: "options" }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve patch", async () => {
    fetchMock.mock("https://test.osprey.no", { status: 204 });

    await expect(
      useFetch("https://test.osprey.no", { method: "patch" }),
    ).resolves.toEqual(expect.objectContaining({ status: 204 }));
  });

  test("should resolve post", async () => {
    fetchMock.mock("https://test.osprey.no", { status: 204 });

    await expect(useFetch("https://test.osprey.no", { method: "post" })).resolves.toEqual(
      expect.objectContaining({ status: 204 }),
    );
  });

  test("should resolve put", async () => {
    fetchMock.mock("https://test.osprey.no", { status: 204 });

    await expect(useFetch("https://test.osprey.no", { method: "put" })).resolves.toEqual(
      expect.objectContaining({ status: 204 }),
    );
  });
});
