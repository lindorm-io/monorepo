import { Amphora } from "@lindorm/amphora";
import { Environment } from "@lindorm/enums";
import { ServerError } from "@lindorm/errors";
import { isArray, isObject } from "@lindorm/is";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger, ILogger } from "@lindorm/logger";
import { readFileSync } from "fs";
import MockDate from "mockdate";
import os from "os";
import { join } from "path";
import request from "supertest";
import { PylonHttpMiddleware } from "../types";
import { Pylon } from "./Pylon";
import { PylonRouter } from "./PylonRouter";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("Pylon", () => {
  let files: Array<string>;
  let spy: any;
  let pylon: Pylon;
  let router: PylonRouter;
  let logger: ILogger;

  beforeEach(() => {
    spy = jest.fn();
    files = [];

    const middlewareSpy: PylonHttpMiddleware = async (ctx, next) => {
      await next();

      spy({
        data: ctx.data,
        metadata: ctx.metadata,
      });
    };

    router = new PylonRouter();

    router.post("/body", async (ctx) => {
      ctx.body = ctx.data;
      ctx.status = 200;
    });

    router.post("/error", async (ctx) => {
      throw new ServerError("Test Error", {
        code: "test_error_code",
        data: { test: "data" },
        debug: { test: "debug" },
        status: ServerError.Status.LoopDetected,
        title: "Test Error Title",
      });
    });

    router.post("/session", async (ctx) => {
      ctx.session = {
        id: "c1460965-fb6d-5a2a-be8a-84f7cd7d1a9f",
        accessToken: "access",
        idToken: "id",
        refreshToken: "refresh",
      };
      ctx.body = ctx.session;
      ctx.status = 200;
    });

    router.get("/session", async (ctx) => {
      ctx.body = ctx.session;
      ctx.status = 200;
    });

    router.post("/upload", async (ctx) => {
      if (isObject(ctx.request.files)) {
        for (const file of Object.values(ctx.request.files)) {
          if (isArray(file)) {
            for (const f of file) {
              files.push(f.filepath);
            }
          }
        }
      }

      ctx.status = 204;
    });

    router.post("/:param_value", async (ctx) => {
      ctx.body = {
        body: ctx.request.body,
        data: ctx.data,
        params: ctx.params,
        query: ctx.query,
      };
      ctx.status = 200;
    });

    const amphora = new Amphora({
      issuer: "http://test.lindorm.io",
      logger: createMockLogger(),
    });

    const kryptos = KryptosKit.from.b64({
      id: "5d17c551-7b6f-474a-8679-dba9bbfa06a2",
      algorithm: "ES256",
      curve: "P-256",
      issuer: "http://test.lindorm.io",
      privateKey:
        "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcyOxjn7CekTvSkiQvqx5JhFOmwPYFVFHmLKfio6aJ1uhRANCAAQfFaJkGZMxDn656YiDrSJ5sLRwip-y3a0VzC4cUPxxAJzuRBRtVqM3GitfTQEiUrzF2pcmMZbteAOhIqLlU_f6",
      publicKey:
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHxWiZBmTMQ5-uemIg60iebC0cIqfst2tFcwuHFD8cQCc7kQUbVajNxorX00BIlK8xdqXJjGW7XgDoSKi5VP3-g",
      operations: ["sign", "verify"],
      type: "EC",
      use: "sig",
    });

    amphora.add(kryptos);

    logger = createMockLogger();

    pylon = new Pylon({
      amphora,
      logger,

      cookies: {
        encryptionKeys: ["abcdefghijklmnopqrstuvwxyz_01234"],
        signatureKeys: ["test-key"],
      },
      domain: "http://test.lindorm.io",
      environment: Environment.Test,
      httpMiddleware: [middlewareSpy],
      httpRouters: [{ path: "/test", router }],
      issuer: "http://test.lindorm.io",
      openIdConfiguration: {
        jwksUri: "http://test.lindorm.io/.well-known/jwks.json",
      },
      name: "@lindorm/pylon",
      parseBody: { formidable: true },
      port: 55555,
      version: "0.0.1",
    });
  });

  test("should return health check OK", async () => {
    await request(pylon.callback)
      .get("/health")
      .set(
        "user-agent",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      )
      .set("x-correlation-id", "correlation-id")
      .set("x-environment", "test")
      .set("x-origin", "test-origin")
      .set("x-request-id", "request-id")
      .expect(204);

    expect(spy).toHaveBeenCalledWith({
      data: {},
      metadata: {
        correlationId: "correlation-id",
        date: MockedDate,
        environment: "test",
        origin: "test-origin",
        requestId: "request-id",
        responseId: expect.any(String),
        sessionId: null,
      },
    });
  });

  test("should return well-known jwks", async () => {
    const response = await request(pylon.callback)
      .get("/.well-known/jwks.json")
      .expect(200);

    expect(response.body).toEqual({
      keys: [
        {
          alg: "ES256",
          crv: "P-256",
          exp: 1719648000,
          iat: 1704096000,
          iss: "http://test.lindorm.io",
          key_ops: ["sign", "verify"],
          kty: "EC",
          kid: "5d17c551-7b6f-474a-8679-dba9bbfa06a2",
          nbf: 1704096000,
          uat: 1704096000,
          use: "sig",
          x: "HxWiZBmTMQ5-uemIg60iebC0cIqfst2tFcwuHFD8cQA",
          y: "nO5EFG1WozcaK19NASJSvMXalyYxlu14A6EiouVT9_o",
        },
      ],
    });
  });

  test("should return well-known openid-configuration", async () => {
    const response = await request(pylon.callback)
      .get("/.well-known/openid-configuration")
      .expect(200);

    expect(response.body).toEqual({
      issuer: "http://test.lindorm.io",
      jwks_uri: "http://test.lindorm.io/.well-known/jwks.json",
    });
  });

  test("should parse params", async () => {
    const response = await request(pylon.callback)
      .post("/test/123456")
      .query({
        query_value: "test",
        query_number: "987654",
      })
      .send({
        body_value: "value",
      })
      .expect(200);

    expect(response.body).toEqual({
      body: {
        body_value: "value",
      },
      data: {
        body_value: "value",
        param_value: 123456,
        query_value: "test",
        query_number: 987654,
      },
      params: {
        param_value: "123456",
      },
      query: {
        query_value: "test",
        query_number: "987654",
      },
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bodyValue: "value",
          paramValue: 123456,
          queryValue: "test",
          queryNumber: 987654,
        },
      }),
    );
  });

  test("should parse body", async () => {
    const response = await request(pylon.callback)
      .post("/test/body")
      .send({
        TestString: "test",
      })
      .expect(200);

    expect(response.body).toEqual({
      test_string: "test",
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { testString: "test" },
      }),
    );
  });

  test("should create session", async () => {
    const response = await request(pylon.callback).post("/test/session").expect(200);

    expect(response.body).toEqual({
      id: "c1460965-fb6d-5a2a-be8a-84f7cd7d1a9f",
      access_token: "access",
      id_token: "id",
      refresh_token: "refresh",
    });

    expect(response.headers).toEqual(
      expect.objectContaining({
        date: "Mon, 01 Jan 2024 08:00:00 GMT",
        "set-cookie": [
          expect.stringContaining("pylon_session="),
          expect.stringContaining("pylon_session.sig="),
        ],
        "x-correlation-id": expect.any(String),
        "x-current-time": "1704096000000",
        "x-request-id": expect.any(String),
        "x-response-id": expect.any(String),
        "x-response-time": "0ms",
        "x-server-environment": "test",
        "x-server-version": "0.0.1",
        "x-session-id": "",
        "x-start-time": "1704096000000",
      }),
    );
  });

  test("should verify session", async () => {
    const response = await request(pylon.callback)
      .get("/test/session")
      .set("Cookie", [
        "pylon_session=JEEyNTZHQ00kdj05LGtpZD1kZWYzMmY5Ny02ODgxLTQ1OWEtOGI3MC02NTM5NTgxY2Q4NzEsYWxnPWRpcixpdj1QSVhaaGIzZmxGdHpwM2k2LHRhZz1xVjRlbzF4ZmE5YXV1SHlRckRpY0VRJDJBYkFRMVpEMGQxRGRzNjVCRlItNm1ZYkRPUVhYcjFfVk9vQlJqM3NZcjZIR0tkOVlOOHk1NDhlYVFDMG9ZUl9oWjNpdmQ0cGRlbW5JbGtNSjFaUE5CaElKdFhXLUZOQ004OVZpMjd4TG9qM3JaTjBKZ2pveHNQQ1YwYkpSSTdTVnFhQWRsOVJ1OFg0QWhEOSQ; priority=high",
        "pylon_session.sig=hw_3jAt2s0h3v3tDOl1yef-oHLI; priority=high",
      ])
      .expect(200);

    expect(response.body).toEqual({
      id: "c1460965-fb6d-5a2a-be8a-84f7cd7d1a9f",
      access_token: "access",
      id_token: "id",
      refresh_token: "refresh",
    });
  });

  test("should upload a file using formidable", async () => {
    await request(pylon.callback)
      .post("/test/upload")
      .attach("upload.txt", join(__dirname, "..", "__fixtures__", "upload.txt"))
      .expect(204);

    expect(files).toEqual([expect.stringContaining(os.tmpdir())]);

    expect(readFileSync(files[0], "utf8")).toEqual("testfile\n");
  });

  test("should handle error correctly", async () => {
    const response = await request(pylon.callback).post("/test/error").expect(508);

    expect(response.body).toEqual({
      error: {
        id: expect.any(String),
        code: "test_error_code",
        data: { test: "data" },
        message: "Test Error",
        name: "ServerError",
        title: "Test Error Title",
        support: expect.any(String),
      },
      server: "Pylon",
    });
  });
});
