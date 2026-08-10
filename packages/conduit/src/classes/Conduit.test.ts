import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import nock from "nock";
import {
  conduitBasicAuthMiddleware,
  conduitChangeRequestQueryMiddleware,
  createConduitCacheMiddleware,
} from "../middleware/index.js";
import type {
  ConduitConfigContext,
  ConduitLookup,
  ConduitMiddleware,
  ConduitRequestOptions,
  ConduitSettings,
} from "../types/index.js";
import { Conduit } from "./Conduit.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Several options have no observable effect on the transport, so the assertion
// has to be on the composed request config instead.
const captureConfig =
  (captured: Array<Partial<ConduitConfigContext>>): ConduitMiddleware =>
  async (ctx, next) => {
    captured.push(ctx.req.config);

    await next();
  };

// Same, but stops the chain before the transport runs — for adapters nock
// cannot intercept.
const captureConfigAndStop =
  (captured: Array<Partial<ConduitConfigContext>>): ConduitMiddleware =>
  async (ctx) => {
    captured.push(ctx.req.config);
  };

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
          strategy: "linear",
          timeout: 25,
          timeoutMax: 3000,
        },
      });
    });

    afterEach(() => {
      vi.resetAllMocks();
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
          middleware: [conduitChangeRequestQueryMiddleware("snake")],
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

    test("should resolve post with multipart form data when the form carries a file", async () => {
      scope = nock("http://test.lindorm.io")
        .post("/test/path", (body) => body.includes("Content-Disposition: form-data"))
        .matchHeader("content-type", /^multipart\/form-data; boundary=/)
        .times(1)
        .reply(204);

      const form = new FormData();

      form.append("file", new File(["upload"], "upload.txt", { type: "text/plain" }));

      await expect(conduit.post("/test/path", { form })).resolves.toEqual(
        expect.objectContaining({ status: 204 }),
      );
    });

    // A file-free form is a urlencoded payload, not a multipart one — axios would
    // serialise a `FormData` as multipart no matter what Content-Type we declare.
    test("should resolve post with urlencoded form data when the form carries no file", async () => {
      scope = nock("http://test.lindorm.io")
        .post("/test/path", "grant_type=client_credentials&scope=read+write")
        .matchHeader("content-type", "application/x-www-form-urlencoded")
        .times(1)
        .reply(204);

      const form = new FormData();

      form.append("grant_type", "client_credentials");
      form.append("scope", "read write");

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
          method: "GET",
          path: "/test/path",
        }),
      ).resolves.toEqual(expect.objectContaining({ status: 204 }));
    });

    test("should resolve request with url", async () => {
      conduit = new Conduit();
      scope = nock("http://test.lindorm.io").get("/test/path").times(1).reply(204);

      await expect(
        conduit.request({
          method: "GET",
          url: "http://test.lindorm.io/test/path",
        }),
      ).resolves.toEqual(expect.objectContaining({ status: 204 }));
    });

    test("should throw on invalid request params", async () => {
      await expect(conduit.request({ method: "GET" })).rejects.toThrow();
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
          strategy: "linear",
          timeout: 25,
          timeoutMax: 3000,
        },
      });
    });

    afterEach(() => {
      vi.resetAllMocks();
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
          strategy: "linear",
          timeout: 25,
          timeoutMax: 3000,
        },
      });
    });

    afterEach(() => {
      vi.resetAllMocks();
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

    test("should not share response objects between requests", async () => {
      scope = nock("http://test.lindorm.io")
        .post("/test/path1")
        .times(1)
        .reply(200, { result: "first" })
        .post("/test/path2")
        .times(1)
        .reply(200, { result: "second" });

      const capturedContexts: any[] = [];

      const captureMw: ConduitMiddleware = async (ctx, next) => {
        await next();
        capturedContexts.push(ctx);
      };

      const [response1, response2] = await Promise.all([
        conduit.post("/test/path1", { middleware: [captureMw] }),
        conduit.post("/test/path2", { middleware: [captureMw] }),
      ]);

      expect(response1.data).toEqual({ result: "first" });
      expect(response2.data).toEqual({ result: "second" });

      expect(capturedContexts).toHaveLength(2);
      expect(capturedContexts[0].res).not.toBe(capturedContexts[1].res);
    });
  });

  describe("cached", () => {
    let conduit: Conduit;
    let scope: nock.Scope;

    beforeEach(() => {
      conduit = new Conduit({ baseUrl: "http://test.lindorm.io" });
    });

    afterEach(() => {
      vi.resetAllMocks();
      scope.done();
    });

    test("should mark a plain response as not cached", async () => {
      scope = nock("http://test.lindorm.io").get("/test/path").times(1).reply(200, {});

      await expect(conduit.get("/test/path")).resolves.toEqual(
        expect.objectContaining({ cached: null }),
      );
    });

    test("should mark an upstream cache hit from response headers", async () => {
      scope = nock("http://test.lindorm.io")
        .get("/test/path")
        .times(1)
        .reply(200, {}, { "x-pylon-cache": "HIT" });

      await expect(conduit.get("/test/path")).resolves.toEqual(
        expect.objectContaining({ cached: "upstream" }),
      );
    });

    test("should mark a client cache hit from the conduit cache middleware", async () => {
      scope = nock("http://test.lindorm.io").get("/test/path").times(1).reply(200, {});

      const cache = createConduitCacheMiddleware();

      const first = await conduit.get("/test/path", { middleware: [cache] });
      expect(first.cached).toBeNull();

      // Second request is served from the client cache — nock is only hit once.
      const second = await conduit.get("/test/path", { middleware: [cache] });
      expect(second.cached).toBe("client");
    });
  });

  describe("timeout", () => {
    // A retryCallback that never retries keeps the assertion on the timeout
    // itself — an aborted request is a NetworkError, which the default callback
    // would otherwise retry.
    const conduitWithTimeout = (timeout?: number): Conduit =>
      new Conduit({
        baseUrl: "http://test.lindorm.io",
        retryCallback: () => false,
        timeout,
      });

    afterEach(() => {
      nock.cleanAll();
    });

    test("should apply the Conduit-level timeout to a request that sets none", async () => {
      nock("http://test.lindorm.io").get("/test/path").delay(500).times(1).reply(200, {});

      await expect(conduitWithTimeout(50).get("/test/path")).rejects.toThrow(
        "timeout of 50ms exceeded",
      );
    });

    test("should let a per-request timeout override a shorter Conduit-level one", async () => {
      nock("http://test.lindorm.io")
        .get("/test/path")
        .delay(200)
        .times(1)
        .reply(200, { responseBody: 1 });

      await expect(
        conduitWithTimeout(50).get("/test/path", { timeout: 5000 }),
      ).resolves.toEqual(
        expect.objectContaining({ data: { responseBody: 1 }, status: 200 }),
      );
    });

    test("should let a per-request timeout override a longer Conduit-level one", async () => {
      nock("http://test.lindorm.io").get("/test/path").delay(500).times(1).reply(200, {});

      await expect(
        conduitWithTimeout(5000).get("/test/path", { timeout: 50 }),
      ).rejects.toThrow("timeout of 50ms exceeded");
    });

    test("should apply a per-request timeout when the Conduit sets none", async () => {
      nock("http://test.lindorm.io").get("/test/path").delay(500).times(1).reply(200, {});

      await expect(
        conduitWithTimeout().get("/test/path", { timeout: 50 }),
      ).rejects.toThrow("timeout of 50ms exceeded");
    });
  });

  describe("withCredentials", () => {
    // `withCredentials` has no observable effect on the node http adapter, so
    // the assertion is on the composed request config the transport receives.
    let scope: nock.Scope;

    afterEach(() => {
      scope.done();
    });

    test("should apply the Conduit-level withCredentials to a request that sets none", async () => {
      scope = nock("http://test.lindorm.io").get("/test/path").times(1).reply(204);

      const captured: Array<Partial<ConduitConfigContext>> = [];
      const conduit = new Conduit({
        baseUrl: "http://test.lindorm.io",
        withCredentials: true,
      });

      await conduit.get("/test/path", { middleware: [captureConfig(captured)] });

      expect(captured[0]?.withCredentials).toBe(true);
    });

    test("should let a per-request withCredentials override the Conduit-level one", async () => {
      scope = nock("http://test.lindorm.io").get("/test/path").times(1).reply(204);

      const captured: Array<Partial<ConduitConfigContext>> = [];
      const conduit = new Conduit({
        baseUrl: "http://test.lindorm.io",
        withCredentials: true,
      });

      await conduit.get("/test/path", {
        middleware: [captureConfig(captured)],
        withCredentials: false,
      });

      expect(captured[0]?.withCredentials).toBe(false);
    });
  });

  describe("expectedResponse", () => {
    afterEach(() => {
      nock.cleanAll();
    });

    test("should apply the Conduit-level expectedResponse to a request that sets none", async () => {
      nock("http://test.lindorm.io").get("/test/path").times(1).reply(204);

      const captured: Array<Partial<ConduitConfigContext>> = [];
      const conduit = new Conduit({
        baseUrl: "http://test.lindorm.io",
        expectedResponse: "arraybuffer",
      });

      await conduit.get("/test/path", { middleware: [captureConfig(captured)] });

      expect(captured[0]?.responseType).toBe("arraybuffer");
    });

    test("should normalise an arraybuffer response to a Buffer from the Conduit-level expectedResponse", async () => {
      nock("http://test.lindorm.io")
        .get("/test/path")
        .times(1)
        .reply(200, Buffer.from("binary payload"), {
          "content-type": "application/octet-stream",
        });

      const conduit = new Conduit({
        baseUrl: "http://test.lindorm.io",
        expectedResponse: "arraybuffer",
      });

      const { data } = await conduit.get("/test/path");

      expect(Buffer.isBuffer(data)).toBe(true);
      expect(data.toString()).toBe("binary payload");
    });

    test("should let a per-request expectedResponse override the Conduit-level one", async () => {
      nock("http://test.lindorm.io")
        .get("/test/path")
        .times(1)
        .reply(200, Buffer.from("binary payload"), {
          "content-type": "application/octet-stream",
        });

      const captured: Array<Partial<ConduitConfigContext>> = [];
      const conduit = new Conduit({
        baseUrl: "http://test.lindorm.io",
        expectedResponse: "arraybuffer",
      });

      const { data } = await conduit.get("/test/path", {
        expectedResponse: "text",
        middleware: [captureConfig(captured)],
      });

      expect(captured[0]?.responseType).toBe("text");
      expect(Buffer.isBuffer(data)).toBe(false);
      expect(data).toBe("binary payload");
    });
  });

  describe("adapter", () => {
    test("should apply the Conduit-level adapter to a request that sets none", async () => {
      const captured: Array<Partial<ConduitConfigContext>> = [];
      const conduit = new Conduit({
        adapter: "fetch",
        baseUrl: "http://test.lindorm.io",
        config: { maxRedirects: 0 },
      });

      await conduit.get("/test/path", { middleware: [captureConfigAndStop(captured)] });

      expect(captured[0]?.adapter).toBe("fetch");
    });

    test("should let a per-request adapter override the Conduit-level one", async () => {
      const captured: Array<Partial<ConduitConfigContext>> = [];
      const conduit = new Conduit({
        adapter: "http",
        baseUrl: "http://test.lindorm.io",
        config: { maxRedirects: 0 },
      });

      await conduit.get("/test/path", {
        adapter: "fetch",
        middleware: [captureConfigAndStop(captured)],
      });

      expect(captured[0]?.adapter).toBe("fetch");
    });
  });

  describe("Conduit-owned axios config", () => {
    // `adapter` and `responseType` are owned by the first-class `adapter` and
    // `expectedResponse` options at BOTH levels, so the axios pass-through bag
    // must not be able to express them — a value there was silently dead, and
    // for `adapter` it also resolved differently per level.

    test("should not accept adapter in the Conduit-level config bag", () => {
      const settings: ConduitSettings = {
        config: {
          // @ts-expect-error `adapter` is the first-class Conduit option.
          adapter: "http",
        },
      };

      expect(new Conduit(settings)).toBeInstanceOf(Conduit);
    });

    test("should not accept responseType in the Conduit-level config bag", () => {
      const settings: ConduitSettings = {
        config: {
          // @ts-expect-error `expectedResponse` is the first-class Conduit option.
          responseType: "arraybuffer",
        },
      };

      expect(new Conduit(settings)).toBeInstanceOf(Conduit);
    });

    test("should not accept adapter in the per-request config bag", () => {
      const options: ConduitRequestOptions = {
        config: {
          // @ts-expect-error `adapter` is the first-class request option.
          adapter: "http",
        },
      };

      expect(options.config).toBeDefined();
    });

    test("should not accept responseType in the per-request config bag", () => {
      const options: ConduitRequestOptions = {
        config: {
          // @ts-expect-error `expectedResponse` is the first-class request option.
          responseType: "arraybuffer",
        },
      };

      expect(options.config).toBeDefined();
    });
  });

  describe("lookup (DNS hook)", () => {
    // A throwing lookup proves the hook is actually threaded to the transport:
    // the http adapter invokes it before any socket, so the request fails at
    // resolution — no network is touched. maxAttempts:1 avoids retry delay.
    const blocked = () =>
      vi.fn<ConduitLookup>(async () => {
        throw new Error("egress blocked");
      });

    test("forwards a Conduit-level lookup to the transport", async () => {
      const lookup = blocked();
      const conduit = new Conduit({ lookup, retryOptions: { maxAttempts: 1 } });

      await expect(conduit.get("https://pinned.lindorm.io/x")).rejects.toThrow();
      expect(lookup).toHaveBeenCalled();
      expect(lookup.mock.calls[0]![0]).toBe("pinned.lindorm.io");
    });

    test("forwards a per-request lookup to the transport", async () => {
      const lookup = blocked();
      const conduit = new Conduit({ retryOptions: { maxAttempts: 1 } });

      await expect(
        conduit.get("https://pinned.lindorm.io/x", { lookup }),
      ).rejects.toThrow();
      expect(lookup).toHaveBeenCalled();
    });

    test("a per-request lookup overrides the Conduit-level one", async () => {
      const appLevel = blocked();
      const perRequest = blocked();
      const conduit = new Conduit({ lookup: appLevel, retryOptions: { maxAttempts: 1 } });

      await expect(
        conduit.get("https://pinned.lindorm.io/x", { lookup: perRequest }),
      ).rejects.toThrow();
      expect(perRequest).toHaveBeenCalled();
      expect(appLevel).not.toHaveBeenCalled();
    });
  });
});
