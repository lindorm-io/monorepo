import { Amphora, IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { Environment } from "@lindorm/enums";
import { ServerError } from "@lindorm/errors";
import { isArray, isObject } from "@lindorm/is";
import { KryptosKit } from "@lindorm/kryptos";
import { ILogger, Logger, LogLevel } from "@lindorm/logger";
import { readFileSync } from "fs";
import MockDate from "mockdate";
import nock from "nock";
import os from "os";
import { join } from "path";
import request from "supertest";
import {
  OPEN_ID_CONFIGURATION_RESPONSE,
  OPEN_ID_JWKS_RESPONSE,
} from "../__fixtures__/auth0";
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
  let amphora: IAmphora;
  let logger: ILogger;

  nock("https://lindorm.eu.auth0.com")
    .get("/.well-known/openid-configuration")
    .times(1)
    .reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

  nock("https://lindorm.eu.auth0.com")
    .get("/.well-known/jwks.json")
    .times(1)
    .reply(200, OPEN_ID_JWKS_RESPONSE);

  nock("https://lindorm.eu.auth0.com").post("/oauth/token").times(999).reply(200, {
    access_token: "access_token",
    expires_in: 3600,
    refresh_token: "refresh_token",
    scope: "openid profile email",
    token_type: "Bearer",
  });

  nock("https://lindorm.eu.auth0.com").get("/userinfo").times(999).reply(200, {
    sub: "sub",
  });

  beforeAll(() => {
    logger = new Logger({ level: LogLevel.Error, readable: true });

    amphora = new Amphora({
      domain: "http://test.lindorm.io",
      logger,
      external: [
        {
          openIdConfiguration: {
            logoutEndpoint: "https://lindorm.eu.auth0.com/v2/logout",
          },
          openIdConfigurationUri:
            "https://lindorm.eu.auth0.com/.well-known/openid-configuration",
        },
      ],
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
        purpose: "token",
        type: "EC",
        use: "sig",
      }),
    );

    amphora.add(
      KryptosKit.from.b64({
        id: "e3f09bd8-6b50-55da-8a05-bd62283f753b",
        algorithm: "HS256",
        privateKey:
          "ZtL9AyQMb60GXUhTYziSizr6SFb_i6bHu8RnN283-gU4I1fPRZbGE9X0QT0YLWW3m1AM1rl2yRf9zS9PhDuylA",
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
        purpose: "session",
        type: "OKP",
        use: "enc",
      }),
    );
  });

  beforeEach(async () => {
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

    router.post("/error", async () => {
      throw new ServerError("Test Error", {
        code: "test_error_code",
        data: { test: "data" },
        debug: { test: "debug" },
        status: ServerError.Status.LoopDetected,
        title: "Test Error Title",
      });
    });

    router.get("/request", async (ctx) => {
      ctx.body = {
        header: ctx.request.header,
        headers: ctx.request.headers,
        url: ctx.request.url,
        origin: ctx.request.origin,
        href: ctx.request.href,
        method: ctx.request.method,
        path: ctx.request.path,
        query: ctx.request.query,
        querystring: ctx.request.querystring,
        search: ctx.request.search,
        host: ctx.request.host,
        hostname: ctx.request.hostname,
        URL: ctx.request.URL,
        fresh: ctx.request.fresh,
        stale: ctx.request.stale,
        idempotent: ctx.request.idempotent,
        protocol: ctx.request.protocol,
        secure: ctx.request.secure,
        ip: ctx.request.ip,
        ips: ctx.request.ips,
        subdomains: ctx.request.subdomains,
      };
      ctx.status = 200;
    });

    router.post("/session", async (ctx) => {
      const accessToken = await ctx.aegis.jwt.sign({
        expires: "1h",
        subject: "subject",
        tokenType: "access_token",
      });

      const idToken = await ctx.aegis.jwt.sign({
        expires: "1h",
        subject: "subject",
        tokenType: "id_token",
      });

      await ctx.session.set({
        id: "c1460965-fb6d-5a2a-be8a-84f7cd7d1a9f",
        accessToken: accessToken.token,
        idToken: idToken.token,
        refreshToken: "refresh",
        expiresAt: 1,
        issuedAt: 1,
        scope: ["openid"],
        subject: "5399df4a-a3d9-5a62-ba81-91dd11f69b6f",
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

    router.post("/amphora", async (ctx) => {
      ctx.amphora.add(
        KryptosKit.generate.auto({
          algorithm: "HS256",
          hidden: true,
          ownerId: "e9cea99a-9bcc-534e-a7ee-c58af70d33ad",
        }),
      );

      ctx.status = 204;
    });

    router.post("/param/:param_value", async (ctx) => {
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

      auth: {
        clientId: "clientId",
        clientSecret: "clientSecret",
        issuer: "https://lindorm.eu.auth0.com/",
        dynamicRedirectDomains: ["http://client.lindorm.io"],
        expose: {
          accessToken: true,
          idToken: true,
          scope: true,
          subject: true,
        },
      },
      environment: Environment.Test,
      httpMiddleware: [middlewareSpy],
      httpRouters: [{ path: "/test", router }],
      name: "@lindorm/pylon",
      openIdConfiguration: { jwksUri: "http://test.lindorm.io/.well-known/jwks.json" },
      parseBody: { formidable: true },
      port: 55555,
      session: { encrypted: true, signed: true },
      version: "0.0.1",
    });

    await pylon.setup();
  });

  afterEach(jest.clearAllMocks);

  test("should setup correctly", async () => {
    expect(amphora.config).toMatchSnapshot();
    expect(amphora.vault).toMatchSnapshot();
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

  test("should return request info", async () => {
    const response = await request(pylon.callback).get("/test/request").expect(200);

    expect(response.body).toEqual({
      fresh: false,
      header: {
        accept_encoding: "gzip, deflate",
        connection: "close",
        host: expect.stringMatching(/127\.0\.0\.1:\d+/),
      },
      headers: {
        accept_encoding: "gzip, deflate",
        connection: "close",
        host: expect.stringMatching(/127\.0\.0\.1:\d+/),
      },
      host: expect.stringMatching(/127\.0\.0\.1:\d+/),
      hostname: "127.0.0.1",
      href: expect.stringMatching(/http:\/\/127\.0\.0\.1:\d+\/test\/request/),
      idempotent: true,
      ip: "::ffff:127.0.0.1",
      ips: [],
      method: "GET",
      origin: expect.stringMatching(/http:\/\/127\.0\.0\.1:\d+/),
      path: "/test/request",
      protocol: "http",
      query: {},
      querystring: "",
      search: "",
      secure: false,
      stale: true,
      subdomains: [],
      url: expect.stringMatching(/http:\/\/127\.0\.0\.1:\d+\/test\/request/),
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
          jku: "http://test.lindorm.io/.well-known/jwks.json",
          key_ops: ["sign", "verify"],
          kid: "5d17c551-7b6f-474a-8679-dba9bbfa06a2",
          kty: "EC",
          nbf: 1704096000,
          purpose: "token",
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
          jku: "http://test.lindorm.io/.well-known/jwks.json",
          key_ops: ["deriveKey"],
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

  test("should handle auth", async () => {
    const loginRes = await request(pylon.callback)
      .get("/auth/login")
      .query({ redirect_uri: "http://client.lindorm.io/login/callback" })
      .expect(302);

    expect(loginRes.headers).toEqual(
      expect.objectContaining({
        location: expect.stringContaining("https://lindorm.eu.auth0.com/authorize"),
        "set-cookie": expect.arrayContaining([
          expect.stringContaining("pylon_login_session="),
        ]),
      }),
    );

    const loginJson = JSON.parse(
      B64.decode(loginRes.headers["set-cookie"][0].split(";")[0].split("=")[1]),
    );

    const loginCallbackRes = await request(pylon.callback)
      .get("/auth/login/callback")
      .set("Cookie", loginRes.headers["set-cookie"])
      .query({ code: "code", state: loginJson.state })
      .expect(302);

    expect(loginCallbackRes.headers).toEqual(
      expect.objectContaining({
        location: expect.stringContaining("http://client.lindorm.io/login/callback"),
        "set-cookie": expect.arrayContaining([
          expect.stringContaining("pylon_session="),
          expect.stringContaining("pylon_login_session="),
        ]),
      }),
    );

    const sessionRes = await request(pylon.callback)
      .get("/test/session")
      .set("Cookie", loginCallbackRes.headers["set-cookie"])
      .expect(200);

    expect(sessionRes.body).toEqual({
      id: expect.any(String),
      access_token: "access_token",
      expires_at: 1707696000000,
      issued_at: 1704096000000,
      refresh_token: "refresh_token",
      scope: ["openid", "profile", "email"],
      subject: "sub",
    });

    const authRes = await request(pylon.callback)
      .get("/auth")
      .set("Cookie", loginCallbackRes.headers["set-cookie"])
      .expect(200);

    expect(authRes.body).toEqual({
      access_token: "access_token",
      scope: ["openid", "profile", "email"],
      subject: "sub",
    });

    await request(pylon.callback)
      .get("/auth/refresh")
      .set("Cookie", loginCallbackRes.headers["set-cookie"])
      .expect(204);

    const userinfoRes = await request(pylon.callback)
      .get("/auth/userinfo")
      .set("Cookie", loginCallbackRes.headers["set-cookie"])
      .expect(200);

    expect(userinfoRes.body).toEqual({ sub: "sub" });

    const logoutRes = await request(pylon.callback)
      .get("/auth/logout")
      .set("Cookie", loginCallbackRes.headers["set-cookie"])
      .query({ redirect_uri: "http://client.lindorm.io/logout/callback" })
      .expect(302);

    expect(logoutRes.headers).toEqual(
      expect.objectContaining({
        location: expect.stringContaining("https://lindorm.eu.auth0.com/v2/logout"),
        "set-cookie": expect.arrayContaining([
          expect.stringContaining("pylon_logout_session="),
        ]),
      }),
    );

    const logoutJson = JSON.parse(
      B64.decode(logoutRes.headers["set-cookie"][0].split(";")[0].split("=")[1]),
    );

    const logoutCallbackRes = await request(pylon.callback)
      .get("/auth/logout/callback")
      .set("Cookie", logoutRes.headers["set-cookie"])
      .query({ state: logoutJson.state })
      .expect(302);

    expect(logoutCallbackRes.headers).toEqual(
      expect.objectContaining({
        location: expect.stringContaining("http://client.lindorm.io/logout/callback"),
        "set-cookie": expect.arrayContaining([
          expect.stringContaining("pylon_session="),
          expect.stringContaining("pylon_logout_session="),
        ]),
      }),
    );
  });

  test("should parse params", async () => {
    const response = await request(pylon.callback)
      .post("/test/param/123456")
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
      access_token: expect.any(String),
      expires_at: 1,
      id_token: expect.any(String),
      issued_at: 1,
      refresh_token: "refresh",
      scope: ["openid"],
      subject: "5399df4a-a3d9-5a62-ba81-91dd11f69b6f",
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
      __meta: {
        app: "Pylon",
        environment: "test",
        name: "unknown",
        version: "0.0.1",
      },
      error: {
        id: expect.any(String),
        code: "test_error_code",
        data: { test: "data" },
        message: "Test Error",
        name: "ServerError",
        title: "Test Error Title",
        support: expect.any(String),
      },
    });
  });

  test("should add amphora key globally", async () => {
    await request(pylon.callback).post("/test/amphora").expect(204);

    expect(amphora.findSync({ ownerId: "e9cea99a-9bcc-534e-a7ee-c58af70d33ad" })).toEqual(
      expect.objectContaining({
        algorithm: "HS256",
        hidden: true,
        ownerId: "e9cea99a-9bcc-534e-a7ee-c58af70d33ad",
      }),
    );
  });
});
