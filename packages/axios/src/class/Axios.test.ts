import axios from "axios";
import { Axios } from "./Axios";
import { AxiosRequestError } from "../error";
import { logger } from "../test";
import { axiosBasicAuthMiddleware, axiosBearerAuthMiddleware } from "../middleware/public";

jest.mock("axios");

const request = axios.request as jest.Mock;

const mocked = {
  data: {},
  headers: {},
  status: 200,
  statusText: "OK",
};

describe("Axios", () => {
  let handler: Axios;

  beforeEach(() => {
    handler = new Axios({
      baseUrl: "http://localhost",
      logger,
      middleware: [],
    });

    request.mockResolvedValue({
      status: 200,
      statusText: "OK",
    });
  });

  afterEach(jest.clearAllMocks);

  test("should GET", async () => {
    await expect(handler.get("/get/path")).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith({
      headers: {},
      method: "get",
      timeout: 3000,
      url: "http://localhost/get/path",
    });
  });

  test("should POST", async () => {
    await expect(handler.post("/post/path")).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith({
      headers: {},
      method: "post",
      timeout: 3000,
      url: "http://localhost/post/path",
    });
  });

  test("should PUT", async () => {
    await expect(handler.put("/put/path")).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith({
      headers: {},
      method: "put",
      timeout: 3000,
      url: "http://localhost/put/path",
    });
  });

  test("should PATCH", async () => {
    await expect(handler.patch("/patch/path")).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith({
      headers: {},
      method: "patch",
      timeout: 3000,
      url: "http://localhost/patch/path",
    });
  });

  test("should DELETE", async () => {
    await expect(handler.delete("/delete/path")).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith({
      headers: {},
      method: "delete",
      timeout: 3000,
      url: "http://localhost/delete/path",
    });
  });

  test("should use basic auth when specified", async () => {
    await expect(
      handler.get("/get/path", {
        middleware: [
          axiosBasicAuthMiddleware({
            username: "user",
            password: "pass",
          }),
        ],
      }),
    ).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {
          password: "pass",
          username: "user",
        },
      }),
    );
  });

  test("should use bearer auth when specified", async () => {
    await expect(
      handler.get("/get/path", {
        middleware: [axiosBearerAuthMiddleware("jwt.jwt.jwt")],
      }),
    ).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          Authorization: "Bearer jwt.jwt.jwt",
        },
      }),
    );
  });

  test("should request once with default options", async () => {
    request.mockRejectedValue({ statusCode: 500 });

    await expect(handler.get("/get/path")).rejects.toThrow(AxiosRequestError);

    expect(request).toHaveBeenCalledTimes(1);
  });

  test("should retry with set options", async () => {
    request.mockRejectedValue({ statusCode: 500 });

    await expect(
      handler.get("/get/path", {
        retry: 3,
      }),
    ).rejects.toThrow(AxiosRequestError);

    expect(request).toHaveBeenCalledTimes(4);
  });

  test("should use data as specified", async () => {
    await expect(
      handler.post("/post/path", {
        data: {
          data1: "value",
        },
      }),
    ).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          data_1: "value",
        },
      }),
    );
  });

  test("should use headers as specified", async () => {
    await expect(
      handler.get("/get/path", {
        headers: {
          CustomHeader: "Value",
        },
      }),
    ).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          CustomHeader: "Value",
        },
      }),
    );
  });

  test("should use params as specified", async () => {
    await expect(
      handler.get("/get/path/:param1", {
        params: {
          param1: "paramValue",
        },
      }),
    ).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://localhost/get/path/paramValue",
      }),
    );
  });

  test("should use query as specified", async () => {
    await expect(
      handler.get("/get/path/query", {
        query: {
          query1: "queryValue",
          query2: 12345,
          query3: "query with spaces",
          query4: "https://test.lindorm.io/route/",
        },
      }),
    ).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://localhost/get/path/query?query_1=queryValue&query_2=12345&query_3=query+with+spaces&query_4=https%3A%2F%2Ftest.lindorm.io%2Froute%2F",
      }),
    );
  });

  test("should not use base url", async () => {
    await expect(handler.get("https://without-base-url/path")).resolves.toStrictEqual(mocked);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://without-base-url/path",
      }),
    );
  });

  test("should throw when URL cannot be resolved from path or axios options", async () => {
    handler = new Axios({ logger });

    await expect(handler.get("/path")).rejects.toThrow(Error);
  });

  test("should throw when data is added to a GET request", async () => {
    await expect(
      handler.get("/path", {
        data: { any: true },
      }),
    ).rejects.toThrow(Error);
  });
});
