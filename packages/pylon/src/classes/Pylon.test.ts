import { Amphora, IAmphora } from "@lindorm/amphora";
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
  let amphora: IAmphora;

  beforeAll(() => {
    // logger = new Logger({ level: LogLevel.Debug, readable: true });
    logger = createMockLogger();

    amphora = new Amphora({
      issuer: "http://test.lindorm.io",
      logger,
    });

    amphora.add(
      KryptosKit.from.b64({
        id: "5d17c551-7b6f-474a-8679-dba9bbfa06a2",
        algorithm: "ES256",
        curve: "P-256",
        privateKey:
          "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcyOxjn7CekTvSkiQvqx5JhFOmwPYFVFHmLKfio6aJ1uhRANCAAQfFaJkGZMxDn656YiDrSJ5sLRwip-y3a0VzC4cUPxxAJzuRBRtVqM3GitfTQEiUrzF2pcmMZbteAOhIqLlU_f6",
        publicKey:
          "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHxWiZBmTMQ5-uemIg60iebC0cIqfst2tFcwuHFD8cQCc7kQUbVajNxorX00BIlK8xdqXJjGW7XgDoSKi5VP3-g",
        operations: ["sign", "verify"],
        type: "EC",
        use: "sig",
      }),
    );

    amphora.add(
      KryptosKit.from.b64({
        algorithm: "HS256",
        privateKey:
          "ZtL9AyQMb60GXUhTYziSizr6SFb_i6bHu8RnN283-gU4I1fPRZbGE9X0QT0YLWW3m1AM1rl2yRf9zS9PhDuylA",
        operations: ["sign", "verify"],
        purpose: "cookie",
        type: "oct",
        use: "sig",
      }),
    );

    amphora.add(
      KryptosKit.from.b64({
        id: "5382ca15-b849-55ae-904a-9196797ccc1b",
        algorithm: "ECDH-ES",
        curve: "X448",
        privateKey:
          "MEYCAQAwBQYDK2VvBDoEOGRWElZ3_EFza2XMyTVr4LroWzaQtjDpyA0h3JX6HcHbf1_91UOlU4_mdMkQUDfRFtL4VR9PmwHT",
        publicKey:
          "MEIwBQYDK2VvAzkACmHn63oaLtiwYY2FyuoObj5A6nLWxyqKgiMa-ueJuYr6WhirvxFYYYY-tB_7HolUBGCca3UxG04",
        operations: ["encrypt", "decrypt"],
        purpose: "session",
        type: "OKP",
        use: "enc",
      }),
    );
  });

  beforeEach(() => {
    spy = jest.fn();
    files = [];

    const middlewareSpy: PylonHttpMiddleware = async (ctx, next) => {
      await next();

      spy({
        data: ctx.data,
        metadata: ctx.state.metadata,
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
      await ctx.session.set({
        id: "c1460965-fb6d-5a2a-be8a-84f7cd7d1a9f",
        accessToken: "access",
        idToken: "id",
        refreshToken: "refresh",
      });
      ctx.status = 204;
    });

    router.get("/session", async (ctx) => {
      ctx.body = ctx.state.session;
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

    pylon = new Pylon({
      amphora,
      logger,

      domain: "http://test.lindorm.io",
      environment: Environment.Test,
      httpMiddleware: [middlewareSpy],
      httpRouters: [{ path: "/test", router }],
      issuer: "http://test.lindorm.io",
      name: "@lindorm/pylon",
      openIdConfiguration: { jwksUri: "http://test.lindorm.io/.well-known/jwks.json" },
      parseBody: { formidable: true },
      port: 55555,
      session: { encrypted: true, signed: true },
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
        {
          alg: "ECDH-ES",
          crv: "X448",
          iat: 1704096000,
          iss: "http://test.lindorm.io",
          key_ops: ["encrypt", "decrypt"],
          kid: "5382ca15-b849-55ae-904a-9196797ccc1b",
          kty: "OKP",
          nbf: 1704096000,
          purpose: "session",
          uat: 1704096000,
          use: "enc",
          x: "CmHn63oaLtiwYY2FyuoObj5A6nLWxyqKgiMa-ueJuYr6WhirvxFYYYY-tB_7HolUBGCca3UxG04",
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

  test("should create and verify session", async () => {
    const r1 = await request(pylon.callback).post("/test/session").expect(204);

    expect(r1.headers).toEqual(
      expect.objectContaining({
        date: "Mon, 01 Jan 2024 08:00:00 GMT",
        "set-cookie": expect.arrayContaining([
          expect.stringContaining("pylon_session="),
          expect.stringContaining("pylon_session.sig="),
        ]),
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

    const r2 = await request(pylon.callback)
      .get("/test/session")
      .set("Cookie", r1.headers["set-cookie"])
      .expect(200);

    expect(r2.body).toEqual({
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
