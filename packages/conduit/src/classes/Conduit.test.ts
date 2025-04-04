import { ChangeCase } from "@lindorm/case";
import { HttpMethod } from "@lindorm/enums";
import { createMockLogger } from "@lindorm/logger";
import { RetryStrategy } from "@lindorm/retry";
import nock from "nock";
import { join } from "path";
import {
  conduitBasicAuthMiddleware,
  conduitChangeRequestQueryMiddleware,
} from "../middleware";
import { ConduitMiddleware } from "../types";
import { Conduit } from "./Conduit";

describe("Conduit", () => {
  describe("constructor", () => {
    test("should construct", () => {
      expect(() => new Conduit()).not.toThrow();
    });

    test("should construct with base url as URL", () => {
      expect(
        () => new Conduit({ baseUrl: new URL("http://test.lindorm.io") }),
      ).not.toThrow();
    });

    test("should construct with base url as string", () => {
      expect(() => new Conduit({ baseUrl: "http://test.lindorm.io" })).not.toThrow();
    });

    test("should construct with all options", () => {
      expect(
        () =>
          new Conduit({
            alias: "alias",
            baseUrl: "http://test.lindorm.io",
            headers: { "x-test-header": "test" },
            timeout: 5000,
            withCredentials: true,
            logger: createMockLogger(),
          }),
      ).not.toThrow();
    });
  });

  describe("methods", () => {
    let conduit: Conduit;
    let scope: nock.Scope;

    beforeEach(() => {
      conduit = new Conduit({
        baseUrl: "http://test.lindorm.io",
        retryOptions: {
          maxAttempts: 3,
          strategy: RetryStrategy.Linear,
          timeout: 25,
          timeoutMax: 3000,
        },
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
      scope.done();
    });

    test("should resolve delete", async () => {
      scope = nock("http://test.lindorm.io").delete("/test/path").times(1).reply(204);

      await expect(conduit.delete("/test/path")).resolves.toEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve get", async () => {
      scope = nock("http://test.lindorm.io")
        .get("/test/path")
        .query({
          snake_query: "one",
        })
        .times(1)
        .reply(200, { responseBody: 1 });

      await expect(
        conduit.get("/test/path", {
          query: {
            snakeQuery: "one",
          },
          middleware: [conduitChangeRequestQueryMiddleware(ChangeCase.Snake)],
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          data: { responseBody: 1 },
          status: 200,
        }),
      );
    });

    test("should resolve head", async () => {
      scope = nock("http://test.lindorm.io").head("/test/path").times(1).reply(204);

      await expect(conduit.head("/test/path")).resolves.toEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve options", async () => {
      scope = nock("http://test.lindorm.io").options("/test/path").times(1).reply(204);

      await expect(conduit.options("/test/path")).resolves.toEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve patch", async () => {
      scope = nock("http://test.lindorm.io").patch("/test/path").times(1).reply(204);

      await expect(conduit.patch("/test/path")).resolves.toEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve post", async () => {
      scope = nock("http://test.lindorm.io").post("/test/path").times(1).reply(204);

      await expect(conduit.post("/test/path")).resolves.toEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve post with form data", async () => {
      scope = nock("http://test.lindorm.io")
        .post("/test/path", (body) => body.includes("Content-Disposition: form-data"))
        .times(1)
        .reply(204);

      const form = new FormData();

      form.append("file", join(__dirname, "..", "__fixtures__", "upload.txt"));

      await expect(conduit.post("/test/path", { form })).resolves.toEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve put", async () => {
      scope = nock("http://test.lindorm.io").put("/test/path").times(1).reply(204);

      await expect(conduit.put("/test/path")).resolves.toEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve request with path", async () => {
      scope = nock("http://test.lindorm.io").get("/test/path").times(1).reply(204);

      await expect(
        conduit.request({
          method: HttpMethod.Get,
          path: "/test/path",
        }),
      ).resolves.toEqual(expect.objectContaining({ status: 204 }));
    });

    test("should resolve request with url", async () => {
      conduit = new Conduit();
      scope = nock("http://test.lindorm.io").get("/test/path").times(1).reply(204);

      await expect(
        conduit.request({
          method: HttpMethod.Get,
          url: "http://test.lindorm.io/test/path",
        }),
      ).resolves.toEqual(expect.objectContaining({ status: 204 }));
    });

    test("should throw on invalid request params", async () => {
      await expect(conduit.request({ method: HttpMethod.Get })).rejects.toThrow();
    });
  });

  describe("auth", () => {
    let conduit: Conduit;
    let scope: nock.Scope;

    beforeEach(() => {
      conduit = new Conduit({
        baseUrl: "http://test.lindorm.io",
        retryOptions: {
          maxAttempts: 3,
          strategy: RetryStrategy.Linear,
          timeout: 25,
          timeoutMax: 3000,
        },
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
      scope.done();
    });

    test("should resolve basic auth", async () => {
      scope = nock("http://test.lindorm.io")
        .post("/test/path")
        .basicAuth({ user: "user", pass: "pass" })
        .times(1)
        .reply(204);

      await expect(
        conduit.post("/test/path", {
          middleware: [conduitBasicAuthMiddleware("user", "pass")],
        }),
      ).resolves.toEqual(expect.objectContaining({ status: 204 }));
    });
  });

  describe("middleware", () => {
    let conduit: Conduit;
    let scope: nock.Scope;

    beforeEach(() => {
      const mw: ConduitMiddleware = async (ctx, next) => {
        ctx.req.body = { hello: "there" };

        await next();

        ctx.res.statusText = "general kenobi";
      };

      conduit = new Conduit({
        baseUrl: "http://test.lindorm.io",
        middleware: [mw],
        retryOptions: {
          maxAttempts: 3,
          strategy: RetryStrategy.Linear,
          timeout: 25,
          timeoutMax: 3000,
        },
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
      scope.done();
    });

    test("should resolve standard middleware", async () => {
      scope = nock("http://test.lindorm.io").post("/test/path").times(1).reply(204);

      await expect(conduit.post("/test/path")).resolves.toEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    test("should resolve custom middleware", async () => {
      scope = nock("http://test.lindorm.io")
        .post("/test/path", { hello: "there" })
        .times(1)
        .reply(204);

      const mw2: ConduitMiddleware = async (ctx, next) => {
        await next();

        ctx.res.status = 999;
      };

      await expect(conduit.post("/test/path", { middleware: [mw2] })).resolves.toEqual(
        expect.objectContaining({ status: 999, statusText: "general kenobi" }),
      );
    });
  });
});
