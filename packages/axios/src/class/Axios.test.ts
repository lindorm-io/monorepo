import nock from "nock";
import { Axios } from "./Axios";
import { axiosBasicAuthMiddleware } from "../middleware";
import { Middleware } from "../types";

describe("Axios", () => {
  describe("constructor", () => {
    test("should construct", () => {
      expect(() => new Axios()).not.toThrow();
    });

    test("should construct with options", () => {
      expect(
        () =>
          new Axios({
            auth: { username: "user", password: "pass" },
            baseURL: "https://test.lindorm.io",
            clientName: "TestClient",
            headers: { "x-test-header": "test" },
            queryCaseTransform: "snake",
            timeout: 5000,
            withCredentials: true,
          }),
      ).not.toThrow();
    });
  });

  describe("methods", () => {
    let axios: Axios;
    let scope: nock.Scope;

    beforeEach(() => {
      axios = new Axios({
        baseURL: "https://test.lindorm.io",
        retry: {
          maximumAttempts: 3,
          maximumMilliseconds: 3000,
          milliseconds: 25,
          strategy: "linear",
        },
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
      scope.done();
    });

    test("should resolve delete", async () => {
      scope = nock("https://test.lindorm.io").delete("/test/path").times(1).reply(204);

      await expect(axios.delete("/test/path")).resolves.toStrictEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve get", async () => {
      scope = nock("https://test.lindorm.io")
        .get("/test/path")
        .query({
          snake_query: "one",
        })
        .times(1)
        .reply(200, { responseBody: 1 });

      await expect(
        axios.get("/test/path", {
          query: {
            snakeQuery: "one",
          },
        }),
      ).resolves.toStrictEqual(
        expect.objectContaining({
          data: { responseBody: 1 },
          status: 200,
        }),
      );
    });

    test("should resolve head", async () => {
      scope = nock("https://test.lindorm.io").head("/test/path").times(1).reply(204);

      await expect(axios.head("/test/path")).resolves.toStrictEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve options", async () => {
      scope = nock("https://test.lindorm.io").options("/test/path").times(1).reply(204);

      await expect(axios.options("/test/path")).resolves.toStrictEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve patch", async () => {
      scope = nock("https://test.lindorm.io").patch("/test/path").times(1).reply(204);

      await expect(axios.patch("/test/path")).resolves.toStrictEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve post", async () => {
      scope = nock("https://test.lindorm.io").post("/test/path").times(1).reply(204);

      await expect(axios.post("/test/path")).resolves.toStrictEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve put", async () => {
      scope = nock("https://test.lindorm.io").put("/test/path").times(1).reply(204);

      await expect(axios.put("/test/path")).resolves.toStrictEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve request with path", async () => {
      scope = nock("https://test.lindorm.io").get("/test/path").times(1).reply(204);

      await expect(
        axios.request({
          method: "get",
          path: "/test/path",
        }),
      ).resolves.toStrictEqual(expect.objectContaining({ status: 204 }));
    });

    test("should resolve request with url", async () => {
      axios = new Axios();
      scope = nock("https://test.lindorm.io").get("/test/path").times(1).reply(204);

      await expect(
        axios.request({
          method: "get",
          url: "https://test.lindorm.io/test/path",
        }),
      ).resolves.toStrictEqual(expect.objectContaining({ status: 204 }));
    });

    test("should throw on invalid request params", async () => {
      await expect(axios.request({ method: "get" })).rejects.toThrow();
    });
  });

  describe("middleware", () => {
    let axios: Axios;
    let scope: nock.Scope;

    beforeEach(() => {
      axios = new Axios({
        baseURL: "https://test.lindorm.io",
        middleware: [axiosBasicAuthMiddleware({ username: "user", password: "pass" })],
        retry: {
          maximumAttempts: 3,
          maximumMilliseconds: 3000,
          milliseconds: 25,
          strategy: "linear",
        },
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
      scope.done();
    });

    test("should resolve standard middleware", async () => {
      scope = nock("https://test.lindorm.io")
        .post("/test/path")
        .basicAuth({ user: "user", pass: "pass" })
        .times(1)
        .reply(204);

      await expect(axios.post("/test/path")).resolves.toStrictEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve custom middleware", async () => {
      scope = nock("https://test.lindorm.io")
        .post("/test/path", { hello: "there" })
        .basicAuth({ user: "user", pass: "pass" })
        .times(1)
        .reply(204);

      const mw: Middleware = async (ctx, next) => {
        ctx.req.body = { hello: "there" };

        await next();

        ctx.res.statusText = "general kenobi";
      };

      await expect(axios.post("/test/path", { middleware: [mw] })).resolves.toStrictEqual(
        expect.objectContaining({ status: 204, statusText: "general kenobi" }),
      );
    });
  });
});
