import { Amphora, IAmphora } from "@lindorm/amphora";

import { ServerError } from "@lindorm/errors";
import { isArray, isObject } from "@lindorm/is";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ILogger } from "@lindorm/logger";
import axios from "axios";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import MockDate from "mockdate";
import nock from "nock";
import os from "os";
import { join } from "path";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

axios.defaults.proxy = false;

import {
  OPEN_ID_CONFIGURATION_RESPONSE,
  OPEN_ID_JWKS_RESPONSE,
} from "../__fixtures__/auth0";
import {
  conduitSignedRequestMiddleware,
  createHttpSignedRequestMiddleware,
} from "../middleware";
import { Pylon } from "./Pylon";
import { PylonRouter } from "./PylonRouter";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("Pylon", () => {
  let files: Array<string>;
  let handlerSpy: any;
  let pylon: Pylon;
  let router: PylonRouter;
  let amphora: IAmphora;
  let logger: ILogger;

  nock("https://lindorm.eu.auth0.com")
    .get("/.well-known/openid-configuration")
    .times(999)
    .reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

  nock("https://lindorm.eu.auth0.com")
    .get("/.well-known/jwks.json")
    .times(999)
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
    logger = createMockLogger();

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

    amphora.add(
      KryptosKit.from.b64({
        id: "257ba848-a577-5c3f-9bdc-ff3ef3f69fa0",
        algorithm: "EdDSA",
        curve: "Ed25519",
        hidden: true,
        privateKey: "MC4CAQAwBQYDK2VwBCIEIHz8wdpCMi7g2mLiYK8UbwsK-mek7rE5hEi-XJXI53sy",
        publicKey: "MCowBQYDK2VwAyEAN9ZHC3n7N-ie40H0DkXuRfHQziEPu-YhDgORjHmuneU",
        type: "OKP",
        use: "sig",
      }),
    );
  });

  beforeEach(async () => {
    handlerSpy = vi.fn();
    files = [];

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

    router.get("/session", async (ctx) => {
      ctx.body = ctx.state.session;
      ctx.status = 200;
    });

    router.post(
      "/signed",
      createHttpSignedRequestMiddleware(async (_, id) => amphora.find({ id }), {
        required: true,
      }),
      async (ctx) => {
        ctx.status = 204;
      },
    );

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
        router: {
          dynamicRedirectDomains: ["http://client.lindorm.io"],
        },
      },

      callbacks: {
        health: () => handlerSpy("health"),
        rightToBeForgotten: () => handlerSpy("rightToBeForgotten"),
      },

      environment: "test",
      routes: [{ path: "/test", router }],
      name: "@lindorm/pylon",
      openIdConfiguration: { jwksUri: "http://test.lindorm.io/.well-known/jwks.json" },
      parseBody: { formidable: true },
      port: 55555,
      session: { enabled: true, encrypted: true, signed: true },
      version: "0.0.1",
    });

    await pylon.setup();
  });

  afterEach(vi.clearAllMocks);

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

    expect(handlerSpy).toHaveBeenCalledWith("health");
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
      origin: null,
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
          exp: 2493100800,
          iat: 1704096000,
          iss: "http://test.lindorm.io",
          jku: "http://test.lindorm.io/.well-known/jwks.json",
          key_ops: ["sign", "verify"],
          kid: "5d17c551-7b6f-474a-8679-dba9bbfa06a2",
          kty: "EC",
          nbf: 1704096000,
          purpose: "token",
          use: "sig",
          x: "HxWiZBmTMQ5-uemIg60iebC0cIqfst2tFcwuHFD8cQA",
          y: "nO5EFG1WozcaK19NASJSvMXalyYxlu14A6EiouVT9_o",
        },
        {
          alg: "ECDH-ES",
          crv: "X448",
          exp: 2493100800,
          iat: 1704096000,
          iss: "http://test.lindorm.io",
          jku: "http://test.lindorm.io/.well-known/jwks.json",
          key_ops: ["deriveKey"],
          kid: "5382ca15-b849-55ae-904a-9196797ccc1b",
          kty: "OKP",
          nbf: 1704096000,
          purpose: "session",
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

  test("should return well-known right-to-be-forgotten", async () => {
    await request(pylon.callback)
      .get("/.well-known/right-to-be-forgotten")
      .set("Authorization", "Bearer access_token")
      .expect(204);

    expect(handlerSpy).toHaveBeenCalledWith("rightToBeForgotten");
  });

  test("should handle auth login redirect and callback", async () => {
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

    const locationUrl = new URL(loginRes.headers["location"]);
    const state = locationUrl.searchParams.get("state")!;

    const loginCallbackRes = await request(pylon.callback)
      .get("/auth/login/callback")
      .set("Cookie", loginRes.headers["set-cookie"])
      .query({ code: "code", state })
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
  });

  test("should sign request", async () => {
    const date = new Date().toUTCString();
    const test = randomBytes(32).toString("base64url");
    const randomString = randomBytes(16).toString("base64url");

    const mockContext: any = {
      req: {
        body: { foo: "bar", baz: 42, randomString },
        headers: { date, test },
      },
    };

    const kryptos = amphora.findSync({ id: "257ba848-a577-5c3f-9bdc-ff3ef3f69fa0" });

    await conduitSignedRequestMiddleware({ kryptos })(mockContext, vi.fn());

    await request(pylon.callback)
      .post("/test/signed")
      .set("date", mockContext.req.headers.date)
      .set("test", mockContext.req.headers.test)
      .set("digest", mockContext.req.headers.digest)
      .set("signature", mockContext.req.headers.signature)
      .send({
        foo: "bar",
        baz: 42,
        random_string: randomString,
      })
      .expect(204);
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
        name: "@lindorm/pylon",
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
