import { AccessSession, AuthorizationSession, Client, RefreshSession } from "../../entity";
import { TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import { baseHash } from "@lindorm-io/core";
import { createAccessToken as _createAccessToken, createIdToken as _createIdToken } from "../token";
import { generateAuthorizationCode as _generateAuthorizationCode } from "./generate-authorization-code";
import { generateCallbackResponse } from "./generate-callback-response";
import { getIdentityUserinfo as _getIdentityUserinfo } from "../identity";
import {
  createTestAccessSession,
  createTestAuthorizationCode,
  createTestAuthorizationSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";

jest.mock("../identity");
jest.mock("../token");
jest.mock("./generate-authorization-code");

const createAccessToken = _createAccessToken as jest.Mock;
const createIdToken = _createIdToken as jest.Mock;
const getIdentityUserinfo = _getIdentityUserinfo as jest.Mock;
const generateAuthorizationCode = _generateAuthorizationCode as jest.Mock;

describe("generateCallbackResponse", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let accessSession: AccessSession;
  let refreshSession: RefreshSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      cookies: {
        set: jest.fn(),
      },
    };

    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseTypes: ["token"],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    accessSession = createTestAccessSession();
    refreshSession = createTestRefreshSession();
    client = createTestClient();

    createAccessToken.mockImplementation(() => ({
      token: "access.token.jwt",
      expiresIn: 999,
    }));

    createIdToken.mockImplementation(() => ({
      token: "id.token.jwt",
      expiresIn: 999,
    }));

    getIdentityUserinfo.mockResolvedValue(TEST_GET_USERINFO_RESPONSE);

    generateAuthorizationCode.mockResolvedValue(
      createTestAuthorizationCode({
        code: "vDQr4zWZxFpINepNGVialEo7yMnEoyJKcEDeMmtS0kHJ08nBqaLaljulOmjzmhhY",
      }),
    );
  });

  afterEach(jest.resetAllMocks);

  test("should resolve access session", async () => {
    await expect(
      generateCallbackResponse(ctx, authorizationSession, client, accessSession),
    ).resolves.toStrictEqual({
      redirect:
        "https://test.client.lindorm.io/redirect?access_token=access.token.jwt&expires_in=999&token_type=Bearer&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    expect(createAccessToken).toHaveBeenCalledWith(ctx, client, accessSession);
  });

  test("should resolve refresh session", async () => {
    await expect(
      generateCallbackResponse(ctx, authorizationSession, client, refreshSession),
    ).resolves.toStrictEqual({
      redirect:
        "https://test.client.lindorm.io/redirect?access_token=access.token.jwt&expires_in=999&token_type=Bearer&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    expect(createAccessToken).toHaveBeenCalledWith(ctx, client, refreshSession);
  });

  test("should resolve state on form post", async () => {
    authorizationSession = createTestAuthorizationSession({
      responseMode: "form_post",
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, client, accessSession),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect",
      body: {
        redirectData:
          "ZXlKemRISnBibWNpT2lKemRISnBibWNpTENKdWRXMWlaWElpT2pFeU15d2lZbTl2YkdWaGJpSTZkSEoxWlgwPQ==",
        state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      },
    });
  });

  test("should resolve callback uri on fragment", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseMode: "fragment",
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, client, accessSession),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect#state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });
  });

  test("should resolve callback uri on query", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseMode: "query",
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, client, accessSession),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect?state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });
  });

  test("should resolve callback uri with code", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseTypes: ["code"],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, client, accessSession),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "code=vDQr4zWZxFpINepNGVialEo7yMnEoyJKcEDeMmtS0kHJ08nBqaLaljulOmjzmhhY",
      ),
    });
  });

  test("should resolve callback uri with access token", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseTypes: ["token"],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, client, accessSession),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "access_token=access.token.jwt&expires_in=999&token_type=Bearer",
      ),
    });
  });

  test("should resolve callback uri with id token", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseTypes: ["id_token"],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, client, accessSession),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining("id_token=id.token.jwt"),
    });
  });

  test("should resolve callback uri with redirect data", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: baseHash(
        baseHash(JSON.stringify({ string: "string", number: 123, boolean: true })),
      ),
      responseMode: "query",
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, client, accessSession),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "redirect_data=ZXlKemRISnBibWNpT2lKemRISnBibWNpTENKdWRXMWlaWElpT2pFeU15d2lZbTl2YkdWaGJpSTZkSEoxWlgwPQ%3D%3D",
      ),
    });
  });
});
